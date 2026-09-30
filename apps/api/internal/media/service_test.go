package media

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"sort"
	"testing"
	"time"
)

type fakeStore struct {
	assets map[string]Asset
}

func newFakeStore() *fakeStore {
	return &fakeStore{assets: make(map[string]Asset)}
}

func (s *fakeStore) CreateProcessing(_ context.Context, asset Asset) error {
	if s.assets == nil {
		s.assets = make(map[string]Asset)
	}
	asset.Status = StatusProcessing
	s.assets[asset.ID] = asset
	return nil
}

func (s *fakeStore) SetStatus(_ context.Context, id, ownerID, status string) error {
	asset, ok := s.assets[id]
	if !ok || asset.OwnerID != ownerID {
		return ErrNotFound
	}
	asset.Status = status
	s.assets[id] = asset
	return nil
}

func (s *fakeStore) FindReady(_ context.Context, id string) (Asset, error) {
	asset, ok := s.assets[id]
	if !ok || asset.Status != StatusReady {
		return Asset{}, ErrNotFound
	}
	return asset, nil
}

func (s *fakeStore) FindReadyByDigest(
	_ context.Context,
	ownerID, purpose string,
	digest []byte,
) (Asset, error) {
	for _, asset := range s.assets {
		if asset.OwnerID == ownerID &&
			asset.Purpose == purpose &&
			asset.Status == StatusReady &&
			bytes.Equal(asset.SHA256, digest) {
			return asset, nil
		}
	}
	return Asset{}, ErrNotFound
}

func (s *fakeStore) ListReady(
	_ context.Context,
	ownerID, purpose string,
	before time.Time,
	beforeID string,
	limit int,
) ([]Asset, error) {
	assets := make([]Asset, 0, len(s.assets))
	for _, asset := range s.assets {
		if asset.OwnerID != ownerID ||
			asset.Purpose != purpose ||
			asset.Status != StatusReady {
			continue
		}
		if !before.IsZero() {
			if asset.CreatedAt.After(before) {
				continue
			}
			if asset.CreatedAt.Equal(before) && asset.ID >= beforeID {
				continue
			}
		}
		assets = append(assets, asset)
	}
	sort.Slice(assets, func(i, j int) bool {
		if assets[i].CreatedAt.Equal(assets[j].CreatedAt) {
			return assets[i].ID > assets[j].ID
		}
		return assets[i].CreatedAt.After(assets[j].CreatedAt)
	})
	if len(assets) > limit {
		assets = assets[:limit]
	}
	return assets, nil
}

func jpegFixture(t *testing.T, width, height int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8((x * 17) % 255),
				G: uint8((y * 23) % 255),
				B: 120,
				A: 255,
			})
		}
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

func TestUploadBackgroundCreatesImmutableReadyAssetWithThumbnail(t *testing.T) {
	store := newFakeStore()
	objects := NewMemoryObjectStore()
	service := NewService(store, objects)

	asset, err := service.UploadBackground(
		context.Background(),
		"owner-id",
		" camera photo.jpg ",
		jpegFixture(t, 48, 32),
		jpegFixture(t, 24, 16),
	)
	if err != nil {
		t.Fatalf("UploadBackground() error = %v", err)
	}
	if asset.Status != StatusReady ||
		asset.CreatedAt.IsZero() ||
		asset.Purpose != PurposeBackground ||
		asset.MimeType != "image/jpeg" ||
		asset.Width != 48 ||
		asset.Height != 32 ||
		asset.URL != assetContentURL(asset.ID) ||
		asset.ThumbnailURL != assetThumbnailURL(asset.ID) ||
		asset.OriginalFilename != "camera photo.jpg" {
		t.Fatalf("unexpected asset: %+v", asset)
	}
	stored := store.assets[asset.ID]
	if stored.Status != StatusReady ||
		stored.StorageKey == "" ||
		stored.ThumbnailStorageKey == "" {
		t.Fatalf("stored asset = %+v", stored)
	}

	opened, body, err := service.Open(context.Background(), asset.ID)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	payload, err := io.ReadAll(body)
	body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if int64(len(payload)) != opened.ByteSize {
		t.Fatalf("payload=%d metadata=%d", len(payload), opened.ByteSize)
	}

	thumbAsset, thumbBody, err := service.OpenThumbnail(
		context.Background(),
		asset.ID,
	)
	if err != nil {
		t.Fatalf("OpenThumbnail() error = %v", err)
	}
	thumbPayload, err := io.ReadAll(thumbBody)
	thumbBody.Close()
	if err != nil {
		t.Fatal(err)
	}
	if int64(len(thumbPayload)) != thumbAsset.ThumbnailByteSize {
		t.Fatalf(
			"thumbnail payload=%d metadata=%d",
			len(thumbPayload),
			thumbAsset.ThumbnailByteSize,
		)
	}
}

func TestUploadBackgroundReusesReadyOwnerAssetByDigest(t *testing.T) {
	store := newFakeStore()
	objects := NewMemoryObjectStore()
	service := NewService(store, objects)
	payload := jpegFixture(t, 40, 24)

	first, err := service.UploadBackground(
		context.Background(),
		"owner-a",
		"first.jpg",
		payload,
		jpegFixture(t, 20, 12),
	)
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.UploadBackground(
		context.Background(),
		"owner-a",
		"second.jpg",
		payload,
		jpegFixture(t, 16, 10),
	)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID {
		t.Fatalf("duplicate upload created a new asset: %s != %s", first.ID, second.ID)
	}
	if len(store.assets) != 1 {
		t.Fatalf("stored assets=%d, want 1", len(store.assets))
	}

	third, err := service.UploadBackground(
		context.Background(),
		"owner-b",
		"same.jpg",
		payload,
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	if third.ID == first.ID {
		t.Fatal("cross-owner upload reused another owner's asset")
	}
}

func TestListBackgroundsPaginatesNewestFirst(t *testing.T) {
	store := newFakeStore()
	base := time.Date(2026, 9, 30, 7, 0, 0, 0, time.UTC)
	for index, id := range []string{
		"123e4567-e89b-42d3-a456-426614174001",
		"123e4567-e89b-42d3-a456-426614174002",
		"123e4567-e89b-42d3-a456-426614174003",
	} {
		store.assets[id] = Asset{
			ID:               id,
			OwnerID:          "owner-a",
			Purpose:          PurposeBackground,
			Status:           StatusReady,
			StorageKey:       id + ".jpg",
			MimeType:         "image/jpeg",
			Width:            1920,
			Height:           1080,
			ByteSize:         10,
			OriginalFilename: "bg.jpg",
			CreatedAt:        base.Add(time.Duration(index) * time.Minute),
		}
	}
	store.assets["123e4567-e89b-42d3-a456-426614174010"] = Asset{
		ID:        "123e4567-e89b-42d3-a456-426614174010",
		OwnerID:   "owner-b",
		Purpose:   PurposeBackground,
		Status:    StatusReady,
		CreatedAt: base.Add(10 * time.Minute),
	}

	service := NewService(store, NewMemoryObjectStore())
	first, err := service.ListBackgrounds(
		context.Background(),
		"owner-a",
		"",
		2,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Items) != 2 || first.NextCursor == "" {
		t.Fatalf("first page=%+v", first)
	}
	if first.Items[0].ID != "123e4567-e89b-42d3-a456-426614174003" ||
		first.Items[1].ID != "123e4567-e89b-42d3-a456-426614174002" {
		t.Fatalf("unexpected order: %+v", first.Items)
	}

	second, err := service.ListBackgrounds(
		context.Background(),
		"owner-a",
		first.NextCursor,
		2,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Items) != 1 ||
		second.Items[0].ID != "123e4567-e89b-42d3-a456-426614174001" ||
		second.NextCursor != "" {
		t.Fatalf("second page=%+v", second)
	}
}

func TestUploadBackgroundRejectsOversizedAndCorruptInput(t *testing.T) {
	service := NewService(newFakeStore(), NewMemoryObjectStore())

	if _, err := service.UploadBackground(
		context.Background(),
		"owner",
		"huge.jpg",
		make([]byte, MaxBackgroundUploadBytes+1),
		nil,
	); !errors.Is(err, ErrMediaTooLarge) {
		t.Fatalf("oversized error = %v", err)
	}

	if _, err := service.UploadBackground(
		context.Background(),
		"owner",
		"broken.jpg",
		[]byte("not-an-image"),
		nil,
	); !errors.Is(err, ErrInvalidImage) {
		t.Fatalf("invalid error = %v", err)
	}
}
