package media

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"image/png"
	"path/filepath"
	"strings"
	"time"
)

const (
	MaxBackgroundUploadBytes = 15 << 20
	MaxBackgroundPixels      = 16_000_000
	MaxBackgroundDimension   = 8192
)

type Service struct {
	store   Store
	objects ObjectStore
}

func NewService(store Store, objects ObjectStore) *Service {
	return &Service{store: store, objects: objects}
}

func assetContentURL(id string) string {
	return "/api/v1/media/assets/" + id + "/content"
}

func randomUUID() (string, error) {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	encoded := hex.EncodeToString(raw[:])
	return fmt.Sprintf(
		"%s-%s-%s-%s-%s",
		encoded[0:8],
		encoded[8:12],
		encoded[12:16],
		encoded[16:20],
		encoded[20:32],
	), nil
}

func normalizeFilename(value string) string {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	value = filepath.Base(value)
	if value == "." || value == "/" {
		return ""
	}
	runes := []rune(value)
	if len(runes) > 255 {
		value = string(runes[:255])
	}
	return value
}

func decodeBackground(raw []byte) (image.Image, string, int, int, error) {
	if len(raw) == 0 {
		return nil, "", 0, 0, ErrInvalidImage
	}
	if len(raw) > MaxBackgroundUploadBytes {
		return nil, "", 0, 0, ErrMediaTooLarge
	}

	config, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "jpeg" && format != "png") {
		return nil, "", 0, 0, ErrInvalidImage
	}
	if config.Width <= 0 ||
		config.Height <= 0 ||
		config.Width > MaxBackgroundDimension ||
		config.Height > MaxBackgroundDimension ||
		int64(config.Width)*int64(config.Height) > MaxBackgroundPixels {
		return nil, "", 0, 0, ErrImageDimensions
	}

	decoded, decodedFormat, err := image.Decode(bytes.NewReader(raw))
	if err != nil || decodedFormat != format {
		return nil, "", 0, 0, ErrInvalidImage
	}
	return decoded, format, config.Width, config.Height, nil
}

func encodeBackground(img image.Image, format string) ([]byte, string, string, error) {
	var output bytes.Buffer
	switch format {
	case "jpeg":
		if err := jpeg.Encode(&output, img, &jpeg.Options{Quality: 90}); err != nil {
			return nil, "", "", ErrInvalidImage
		}
		return output.Bytes(), "image/jpeg", ".jpg", nil
	case "png":
		encoder := png.Encoder{CompressionLevel: png.DefaultCompression}
		if err := encoder.Encode(&output, img); err != nil {
			return nil, "", "", ErrInvalidImage
		}
		return output.Bytes(), "image/png", ".png", nil
	default:
		return nil, "", "", ErrInvalidImage
	}
}

func (s *Service) UploadBackground(
	ctx context.Context,
	ownerID string,
	filename string,
	raw []byte,
) (Asset, error) {
	decoded, format, width, height, err := decodeBackground(raw)
	if err != nil {
		return Asset{}, err
	}
	normalized, mimeType, extension, err := encodeBackground(decoded, format)
	if err != nil {
		return Asset{}, err
	}
	if len(normalized) > MaxBackgroundUploadBytes {
		return Asset{}, ErrMediaTooLarge
	}

	id, err := randomUUID()
	if err != nil {
		return Asset{}, fmt.Errorf("generate media asset id: %w", err)
	}
	digest := sha256.Sum256(normalized)
	asset := Asset{
		ID:               id,
		OwnerID:          ownerID,
		Purpose:          PurposeBackground,
		StorageKey:       strings.ReplaceAll(id, "-", "") + extension,
		MimeType:         mimeType,
		Width:            width,
		Height:           height,
		ByteSize:         int64(len(normalized)),
		SHA256:           append([]byte(nil), digest[:]...),
		Status:           StatusProcessing,
		OriginalFilename: normalizeFilename(filename),
		URL:              assetContentURL(id),
		CreatedAt:        time.Now().UTC(),
	}
	if err = s.store.CreateProcessing(ctx, asset); err != nil {
		return Asset{}, err
	}
	if err = s.objects.Put(ctx, asset.StorageKey, asset.MimeType, normalized); err != nil {
		_ = s.objects.Delete(ctx, asset.StorageKey)
		_ = s.store.SetStatus(ctx, asset.ID, asset.OwnerID, StatusFailed)
		if errors.Is(err, ErrStorageUnavailable) {
			return Asset{}, err
		}
		return Asset{}, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	if err = s.store.SetStatus(ctx, asset.ID, asset.OwnerID, StatusReady); err != nil {
		_ = s.objects.Delete(ctx, asset.StorageKey)
		_ = s.store.SetStatus(ctx, asset.ID, asset.OwnerID, StatusFailed)
		return Asset{}, err
	}
	asset.Status = StatusReady
	return asset, nil
}

func (s *Service) Open(ctx context.Context, id string) (Asset, io.ReadCloser, error) {
	asset, err := s.store.FindReady(ctx, id)
	if err != nil {
		return Asset{}, nil, err
	}
	body, err := s.objects.Open(ctx, asset.StorageKey)
	if err != nil {
		if errors.Is(err, ErrStorageUnavailable) {
			return Asset{}, nil, err
		}
		return Asset{}, nil, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	asset.URL = assetContentURL(asset.ID)
	return asset, body, nil
}

