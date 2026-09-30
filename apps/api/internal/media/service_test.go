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

func cloneAsset(asset Asset) Asset {
	cloned := asset
	cloned.SHA256 = append([]byte(nil), asset.SHA256...)
	cloned.Variants = make(map[string]Variant, len(asset.Variants))
	for name, variant := range asset.Variants {
		cloned.Variants[name] = variant
	}
	return cloned
}

func (s *fakeStore) CreateProcessing(
	_ context.Context,
	asset Asset,
	variants []Variant,
) error {
	if s.assets == nil {
		s.assets = make(map[string]Asset)
	}
	asset.Status = StatusProcessing
	asset.Variants = make(map[string]Variant, len(variants))
	for _, variant := range variants {
		asset.Variants[variant.Name] = variant
	}
	s.assets[asset.ID] = cloneAsset(asset)
	return nil
}

func (s *fakeStore) SetStatus(
	_ context.Context,
	id, ownerID, status string,
) error {
	asset, ok := s.assets[id]
	if !ok || asset.OwnerID != ownerID {
		return ErrNotFound
	}
	asset.Status = status
	s.assets[id] = asset
	return nil
}

func (s *fakeStore) FindReady(
	_ context.Context,
	id string,
) (Asset, error) {
	asset, ok := s.assets[id]
	if !ok || asset.Status != StatusReady {
		return Asset{}, ErrNotFound
	}
	return cloneAsset(asset), nil
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
			return cloneAsset(asset), nil
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
		assets = append(assets, cloneAsset(asset))
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

func TestUploadImageCreatesImmutableResponsiveAsset(t *testing.T) {
	store := newFakeStore()
	objects := NewMemoryObjectStore()
	service := NewService(store, objects)

	asset, err := service.UploadImage(
		context.Background(),
		"owner-id",
		" camera photo.jpg ",
		jpegFixture(t, 1300, 800),
	)
	if err != nil {
		t.Fatalf("UploadImage() error = %v", err)
	}
	if asset.Status != StatusReady ||
		asset.CreatedAt.IsZero() ||
		asset.Purpose != PurposeImage ||
		asset.MimeType != "image/jpeg" ||
		asset.Width != 1300 ||
		asset.Height != 800 ||
		asset.URL != assetContentURL(asset.ID) ||
		asset.OriginalFilename != "camera photo.jpg" {
		t.Fatalf("unexpected asset: %+v", asset)
	}
	if asset.Renditions.Thumbnail == nil ||
		asset.Renditions.Thumbnail.Width != 480 ||
		asset.Renditions.Medium == nil ||
		asset.Renditions.Medium.Width != 1280 ||
		asset.Renditions.Large != nil {
		t.Fatalf("unexpected renditions: %+v", asset.Renditions)
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

	_, thumbnail, thumbnailBody, err := service.OpenVariant(
		context.Background(),
		asset.ID,
		VariantThumbnail,
	)
	if err != nil {
		t.Fatalf("OpenVariant() error = %v", err)
	}
	thumbnailPayload, err := io.ReadAll(thumbnailBody)
	thumbnailBody.Close()
	if err != nil {
		t.Fatal(err)
	}
	if int64(len(thumbnailPayload)) != thumbnail.ByteSize {
		t.Fatalf(
			"thumbnail payload=%d metadata=%d",
			len(thumbnailPayload),
			thumbnail.ByteSize,
		)
	}
	decoded, _, err := image.Decode(bytes.NewReader(thumbnailPayload))
	if err != nil {
		t.Fatalf("thumbnail is not decodable: %v", err)
	}
	if decoded.Bounds().Dx() != 480 {
		t.Fatalf("thumbnail width=%d", decoded.Bounds().Dx())
	}

	_, large, largeBody, err := service.OpenVariant(
		context.Background(),
		asset.ID,
		VariantLarge,
	)
	if err != nil {
		t.Fatalf("missing generated large rendition should fall back to master: %v", err)
	}
	largePayload, err := io.ReadAll(largeBody)
	largeBody.Close()
	if err != nil {
		t.Fatal(err)
	}
	if large.Width != asset.Width ||
		large.Height != asset.Height ||
		large.ByteSize != asset.ByteSize ||
		int64(len(largePayload)) != asset.ByteSize {
		t.Fatalf("large fallback=%+v payload=%d asset=%+v", large, len(largePayload), asset)
	}
	if _, _, _, err = service.OpenVariant(
		context.Background(),
		asset.ID,
		"unknown",
	); !errors.Is(err, ErrVariantNotFound) {
		t.Fatalf("unknown variant error=%v", err)
	}
}

func TestUploadImageDoesNotUpscaleSmallAssets(t *testing.T) {
	service := NewService(newFakeStore(), NewMemoryObjectStore())
	asset, err := service.UploadImage(
		context.Background(),
		"owner-id",
		"small.jpg",
		jpegFixture(t, 320, 180),
	)
	if err != nil {
		t.Fatal(err)
	}
	if asset.Renditions.Thumbnail != nil ||
		asset.Renditions.Medium != nil ||
		asset.Renditions.Large != nil {
		t.Fatalf("small image was unnecessarily upscaled: %+v", asset.Renditions)
	}
}

func TestUploadImageReusesReadyOwnerAssetByDigest(t *testing.T) {
	store := newFakeStore()
	objects := NewMemoryObjectStore()
	service := NewService(store, objects)
	payload := jpegFixture(t, 640, 360)

	first, err := service.UploadImage(
		context.Background(),
		"owner-a",
		"first.jpg",
		payload,
	)
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.UploadImage(
		context.Background(),
		"owner-a",
		"second.jpg",
		payload,
	)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID {
		t.Fatalf(
			"duplicate upload created a new asset: %s != %s",
			first.ID,
			second.ID,
		)
	}
	if len(store.assets) != 1 {
		t.Fatalf("stored assets=%d, want 1", len(store.assets))
	}

	third, err := service.UploadImage(
		context.Background(),
		"owner-b",
		"same.jpg",
		payload,
	)
	if err != nil {
		t.Fatal(err)
	}
	if third.ID == first.ID {
		t.Fatal("cross-owner upload reused another owner's asset")
	}
}

func TestListImagesPaginatesNewestFirst(t *testing.T) {
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
			Purpose:          PurposeImage,
			Status:           StatusReady,
			StorageKey:       id + ".jpg",
			MimeType:         "image/jpeg",
			Width:            1920,
			Height:           1080,
			ByteSize:         10,
			OriginalFilename: "image.jpg",
			CreatedAt:        base.Add(time.Duration(index) * time.Minute),
		}
	}
	store.assets["123e4567-e89b-42d3-a456-426614174010"] = Asset{
		ID:        "123e4567-e89b-42d3-a456-426614174010",
		OwnerID:   "owner-b",
		Purpose:   PurposeImage,
		Status:    StatusReady,
		CreatedAt: base.Add(10 * time.Minute),
	}

	service := NewService(store, NewMemoryObjectStore())
	first, err := service.ListImages(
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

	second, err := service.ListImages(
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

func TestUploadImageRejectsOversizedAndCorruptInput(t *testing.T) {
	service := NewService(newFakeStore(), NewMemoryObjectStore())

	if _, err := service.UploadImage(
		context.Background(),
		"owner",
		"huge.jpg",
		make([]byte, MaxImageUploadBytes+1),
	); !errors.Is(err, ErrMediaTooLarge) {
		t.Fatalf("oversized error = %v", err)
	}

	if _, err := service.UploadImage(
		context.Background(),
		"owner",
		"broken.jpg",
		[]byte("not-an-image"),
	); !errors.Is(err, ErrInvalidImage) {
		t.Fatalf("invalid error = %v", err)
	}
}


func TestResolveOwnedImageEnforcesOwnerAndPurpose(t *testing.T) {
	store := newFakeStore()
	const assetID = "123e4567-e89b-42d3-a456-426614174099"
	store.assets[assetID] = Asset{
		ID:       assetID,
		OwnerID:  "owner-a",
		Purpose:  PurposeImage,
		Status:   StatusReady,
		Width:    1920,
		Height:   1080,
	}

	service := NewService(store, NewMemoryObjectStore())
	url, width, height, found, err := service.ResolveOwnedImage(
		context.Background(),
		"owner-a",
		assetID,
	)
	if err != nil {
		t.Fatal(err)
	}
	if !found ||
		url != assetContentURL(assetID) ||
		width != 1920 ||
		height != 1080 {
		t.Fatalf(
			"owned image resolution = url:%q width:%d height:%d found:%v",
			url,
			width,
			height,
			found,
		)
	}

	if _, _, _, found, err = service.ResolveOwnedImage(
		context.Background(),
		"owner-b",
		assetID,
	); err != nil || found {
		t.Fatalf("cross-owner image resolution found=%v err=%v", found, err)
	}

	store.assets[assetID] = Asset{
		ID:       assetID,
		OwnerID:  "owner-a",
		Purpose:  "future-purpose",
		Status:   StatusReady,
		Width:    1920,
		Height:   1080,
	}
	if _, _, _, found, err = service.ResolveOwnedImage(
		context.Background(),
		"owner-a",
		assetID,
	); err != nil || found {
		t.Fatalf("non-image purpose resolution found=%v err=%v", found, err)
	}
}
