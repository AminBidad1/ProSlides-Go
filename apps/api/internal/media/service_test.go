package media

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"testing"
)

type fakeStore struct {
	asset Asset
}

func (s *fakeStore) CreateProcessing(_ context.Context, asset Asset) error {
	s.asset = asset
	s.asset.Status = StatusProcessing
	return nil
}

func (s *fakeStore) SetStatus(_ context.Context, id, ownerID, status string) error {
	if s.asset.ID != id || s.asset.OwnerID != ownerID {
		return ErrNotFound
	}
	s.asset.Status = status
	return nil
}

func (s *fakeStore) FindReady(_ context.Context, id string) (Asset, error) {
	if s.asset.ID != id || s.asset.Status != StatusReady {
		return Asset{}, ErrNotFound
	}
	return s.asset, nil
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

func TestUploadBackgroundCreatesImmutableReadyAsset(t *testing.T) {
	store := &fakeStore{}
	objects := NewMemoryObjectStore()
	service := NewService(store, objects)

	asset, err := service.UploadBackground(
		context.Background(),
		"owner-id",
		" camera photo.jpg ",
		jpegFixture(t, 48, 32),
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
		asset.URL != assetContentURL(asset.ID) {
		t.Fatalf("unexpected asset: %+v", asset)
	}
	if store.asset.Status != StatusReady || store.asset.StorageKey == "" {
		t.Fatalf("stored asset = %+v", store.asset)
	}

	opened, body, err := service.Open(context.Background(), asset.ID)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer body.Close()
	payload, err := io.ReadAll(body)
	if err != nil {
		t.Fatal(err)
	}
	if int64(len(payload)) != opened.ByteSize {
		t.Fatalf("payload=%d metadata=%d", len(payload), opened.ByteSize)
	}
	if _, _, err = image.Decode(bytes.NewReader(payload)); err != nil {
		t.Fatalf("stored normalized image is not decodable: %v", err)
	}
}

func TestUploadBackgroundRejectsOversizedAndCorruptInput(t *testing.T) {
	service := NewService(&fakeStore{}, NewMemoryObjectStore())

	if _, err := service.UploadBackground(
		context.Background(),
		"owner",
		"huge.jpg",
		make([]byte, MaxBackgroundUploadBytes+1),
	); !errors.Is(err, ErrMediaTooLarge) {
		t.Fatalf("oversized error = %v", err)
	}

	if _, err := service.UploadBackground(
		context.Background(),
		"owner",
		"broken.jpg",
		[]byte("not-an-image"),
	); !errors.Is(err, ErrInvalidImage) {
		t.Fatalf("invalid error = %v", err)
	}
}
