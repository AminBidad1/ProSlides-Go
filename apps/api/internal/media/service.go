package media

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	MaxBackgroundUploadBytes = 15 << 20
	MaxBackgroundPixels      = 16_000_000
	MaxBackgroundDimension   = 8192
	MaxThumbnailUploadBytes  = 1 << 20
	MaxThumbnailPixels       = 512 * 512
	MaxThumbnailDimension    = 512
	DefaultLibraryPageSize   = 18
	MaxLibraryPageSize       = 48
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

func assetThumbnailURL(id string) string {
	return "/api/v1/media/assets/" + id + "/thumbnail"
}

func withDeliveryURLs(asset Asset) Asset {
	asset.URL = assetContentURL(asset.ID)
	if asset.ThumbnailStorageKey != "" {
		asset.ThumbnailURL = assetThumbnailURL(asset.ID)
	} else {
		asset.ThumbnailURL = asset.URL
	}
	return asset
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

func decodeImage(
	raw []byte,
	maxBytes int,
	maxPixels int64,
	maxDimension int,
) (image.Image, string, int, int, error) {
	if len(raw) == 0 {
		return nil, "", 0, 0, ErrInvalidImage
	}
	if len(raw) > maxBytes {
		return nil, "", 0, 0, ErrMediaTooLarge
	}

	config, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "jpeg" && format != "png") {
		return nil, "", 0, 0, ErrInvalidImage
	}
	if config.Width <= 0 ||
		config.Height <= 0 ||
		config.Width > maxDimension ||
		config.Height > maxDimension ||
		int64(config.Width)*int64(config.Height) > maxPixels {
		return nil, "", 0, 0, ErrImageDimensions
	}

	decoded, decodedFormat, err := image.Decode(bytes.NewReader(raw))
	if err != nil || decodedFormat != format {
		return nil, "", 0, 0, ErrInvalidImage
	}
	return decoded, format, config.Width, config.Height, nil
}

func encodeImage(img image.Image, format string) ([]byte, string, string, error) {
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

func normalizeBackground(raw []byte) ([]byte, string, string, int, int, error) {
	decoded, format, width, height, err := decodeImage(
		raw,
		MaxBackgroundUploadBytes,
		MaxBackgroundPixels,
		MaxBackgroundDimension,
	)
	if err != nil {
		return nil, "", "", 0, 0, err
	}
	normalized, mimeType, extension, err := encodeImage(decoded, format)
	if err != nil {
		return nil, "", "", 0, 0, err
	}
	if len(normalized) > MaxBackgroundUploadBytes {
		return nil, "", "", 0, 0, ErrMediaTooLarge
	}
	return normalized, mimeType, extension, width, height, nil
}

func normalizeThumbnail(raw []byte) ([]byte, string, string, error) {
	if len(raw) == 0 {
		return nil, "", "", nil
	}
	decoded, format, _, _, err := decodeImage(
		raw,
		MaxThumbnailUploadBytes,
		MaxThumbnailPixels,
		MaxThumbnailDimension,
	)
	if err != nil {
		return nil, "", "", err
	}
	normalized, mimeType, extension, err := encodeImage(decoded, format)
	if err != nil {
		return nil, "", "", err
	}
	if len(normalized) > MaxThumbnailUploadBytes {
		return nil, "", "", ErrMediaTooLarge
	}
	return normalized, mimeType, extension, nil
}

func (s *Service) UploadBackground(
	ctx context.Context,
	ownerID string,
	filename string,
	raw []byte,
	thumbnail []byte,
) (Asset, error) {
	normalized, mimeType, extension, width, height, err :=
		normalizeBackground(raw)
	if err != nil {
		return Asset{}, err
	}

	digest := sha256.Sum256(normalized)
	existing, findErr := s.store.FindReadyByDigest(
		ctx,
		ownerID,
		PurposeBackground,
		digest[:],
	)
	if findErr == nil {
		return withDeliveryURLs(existing), nil
	}
	if !errors.Is(findErr, ErrNotFound) {
		return Asset{}, findErr
	}

	normalizedThumb, thumbnailMimeType, thumbnailExtension, err :=
		normalizeThumbnail(thumbnail)
	if err != nil {
		return Asset{}, err
	}

	id, err := randomUUID()
	if err != nil {
		return Asset{}, fmt.Errorf("generate media asset id: %w", err)
	}
	storageBase := strings.ReplaceAll(id, "-", "")
	asset := Asset{
		ID:               id,
		OwnerID:          ownerID,
		Purpose:          PurposeBackground,
		StorageKey:       storageBase + extension,
		MimeType:         mimeType,
		Width:            width,
		Height:           height,
		ByteSize:         int64(len(normalized)),
		SHA256:           append([]byte(nil), digest[:]...),
		Status:           StatusProcessing,
		OriginalFilename: normalizeFilename(filename),
		CreatedAt:        time.Now().UTC(),
	}
	if len(normalizedThumb) > 0 {
		asset.ThumbnailStorageKey = storageBase + ".thumb" + thumbnailExtension
		asset.ThumbnailMimeType = thumbnailMimeType
		asset.ThumbnailByteSize = int64(len(normalizedThumb))
	}

	if err = s.store.CreateProcessing(ctx, asset); err != nil {
		return Asset{}, err
	}
	cleanup := func() {
		_ = s.objects.Delete(ctx, asset.StorageKey)
		if asset.ThumbnailStorageKey != "" {
			_ = s.objects.Delete(ctx, asset.ThumbnailStorageKey)
		}
		_ = s.store.SetStatus(ctx, asset.ID, asset.OwnerID, StatusFailed)
	}

	if err = s.objects.Put(
		ctx,
		asset.StorageKey,
		asset.MimeType,
		normalized,
	); err != nil {
		cleanup()
		if errors.Is(err, ErrStorageUnavailable) {
			return Asset{}, err
		}
		return Asset{}, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	if asset.ThumbnailStorageKey != "" {
		if err = s.objects.Put(
			ctx,
			asset.ThumbnailStorageKey,
			asset.ThumbnailMimeType,
			normalizedThumb,
		); err != nil {
			cleanup()
			if errors.Is(err, ErrStorageUnavailable) {
				return Asset{}, err
			}
			return Asset{}, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
		}
	}
	if err = s.store.SetStatus(
		ctx,
		asset.ID,
		asset.OwnerID,
		StatusReady,
	); err != nil {
		cleanup()
		return Asset{}, err
	}
	asset.Status = StatusReady
	return withDeliveryURLs(asset), nil
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
	return withDeliveryURLs(asset), body, nil
}

func (s *Service) OpenThumbnail(
	ctx context.Context,
	id string,
) (Asset, io.ReadCloser, error) {
	asset, err := s.store.FindReady(ctx, id)
	if err != nil {
		return Asset{}, nil, err
	}
	if asset.ThumbnailStorageKey == "" {
		return s.Open(ctx, id)
	}
	body, err := s.objects.Open(ctx, asset.ThumbnailStorageKey)
	if err != nil {
		if errors.Is(err, ErrStorageUnavailable) {
			return Asset{}, nil, err
		}
		return Asset{}, nil, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	return withDeliveryURLs(asset), body, nil
}

func encodeCursor(asset Asset) string {
	value := strconv.FormatInt(asset.CreatedAt.UTC().UnixNano(), 10) +
		"|" + asset.ID
	return base64.RawURLEncoding.EncodeToString([]byte(value))
}

func decodeCursor(value string) (time.Time, string, error) {
	if strings.TrimSpace(value) == "" {
		return time.Time{}, "", nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return time.Time{}, "", ErrInvalidCursor
	}
	parts := strings.SplitN(string(raw), "|", 2)
	if len(parts) != 2 || !validAssetUUID(parts[1]) {
		return time.Time{}, "", ErrInvalidCursor
	}
	nanos, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || nanos <= 0 {
		return time.Time{}, "", ErrInvalidCursor
	}
	return time.Unix(0, nanos).UTC(), parts[1], nil
}

func (s *Service) ListBackgrounds(
	ctx context.Context,
	ownerID string,
	cursor string,
	limit int,
) (AssetPage, error) {
	if limit <= 0 {
		limit = DefaultLibraryPageSize
	}
	if limit > MaxLibraryPageSize {
		limit = MaxLibraryPageSize
	}
	before, beforeID, err := decodeCursor(cursor)
	if err != nil {
		return AssetPage{}, err
	}
	assets, err := s.store.ListReady(
		ctx,
		ownerID,
		PurposeBackground,
		before,
		beforeID,
		limit+1,
	)
	if err != nil {
		return AssetPage{}, err
	}

	page := AssetPage{Items: make([]Asset, 0, min(limit, len(assets)))}
	hasMore := len(assets) > limit
	if hasMore {
		assets = assets[:limit]
	}
	for _, asset := range assets {
		page.Items = append(page.Items, withDeliveryURLs(asset))
	}
	if hasMore && len(page.Items) > 0 {
		page.NextCursor = encodeCursor(page.Items[len(page.Items)-1])
	}
	return page, nil
}
