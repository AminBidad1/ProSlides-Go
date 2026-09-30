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
	MaxImageUploadBytes   = 15 << 20
	MaxImagePixels        = 16_000_000
	MaxImageDimension     = 8192
	DefaultLibraryPageSize = 18
	MaxLibraryPageSize     = 48
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

func assetRenditionURL(id, variant string) string {
	return "/api/v1/media/assets/" + id + "/renditions/" + variant
}

func withDeliveryURLs(asset Asset) Asset {
	asset.URL = assetContentURL(asset.ID)
	asset.Renditions = AssetRenditions{}
	for name, variant := range asset.Variants {
		rendition := &Rendition{
			URL:      assetRenditionURL(asset.ID, name),
			Width:    variant.Width,
			Height:   variant.Height,
			ByteSize: variant.ByteSize,
		}
		switch name {
		case VariantThumbnail:
			asset.Renditions.Thumbnail = rendition
		case VariantMedium:
			asset.Renditions.Medium = rendition
		case VariantLarge:
			asset.Renditions.Large = rendition
		}
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

func decodeImage(raw []byte) (image.Image, string, int, int, error) {
	if len(raw) == 0 {
		return nil, "", 0, 0, ErrInvalidImage
	}
	if len(raw) > MaxImageUploadBytes {
		return nil, "", 0, 0, ErrMediaTooLarge
	}

	config, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "jpeg" && format != "png") {
		return nil, "", 0, 0, ErrInvalidImage
	}
	if config.Width <= 0 ||
		config.Height <= 0 ||
		config.Width > MaxImageDimension ||
		config.Height > MaxImageDimension ||
		int64(config.Width)*int64(config.Height) > MaxImagePixels {
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

func normalizeImage(
	raw []byte,
) ([]byte, string, string, int, int, *image.NRGBA, error) {
	decoded, format, width, height, err := decodeImage(raw)
	if err != nil {
		return nil, "", "", 0, 0, nil, err
	}
	normalized, mimeType, extension, err := encodeImage(decoded, format)
	if err != nil {
		return nil, "", "", 0, 0, nil, err
	}
	if len(normalized) > MaxImageUploadBytes {
		return nil, "", "", 0, 0, nil, ErrMediaTooLarge
	}
	return normalized, mimeType, extension, width, height, imageToNRGBA(decoded), nil
}

func buildVariants(
	source *image.NRGBA,
	format, mimeType, extension, storageBase string,
) ([]Variant, map[string][]byte, error) {
	variants := make([]Variant, 0, len(imageVariantSpecs))
	payloads := make(map[string][]byte, len(imageVariantSpecs))
	width := source.Bounds().Dx()
	height := source.Bounds().Dy()

	for _, spec := range imageVariantSpecs {
		targetWidth, targetHeight, shouldResize := scaledDimensions(
			width,
			height,
			spec.maxLongEdge,
		)
		if !shouldResize {
			continue
		}

		resized := resizeBilinear(source, targetWidth, targetHeight)
		encoded, _, _, err := encodeImage(resized, format)
		if err != nil {
			return nil, nil, err
		}
		variant := Variant{
			Name:       spec.name,
			StorageKey: storageBase + spec.suffix + extension,
			MimeType:   mimeType,
			Width:      targetWidth,
			Height:     targetHeight,
			ByteSize:   int64(len(encoded)),
		}
		variants = append(variants, variant)
		payloads[spec.name] = encoded
	}
	return variants, payloads, nil
}

func (s *Service) UploadImage(
	ctx context.Context,
	ownerID string,
	filename string,
	raw []byte,
) (Asset, error) {
	normalized, mimeType, extension, width, height, source, err :=
		normalizeImage(raw)
	if err != nil {
		return Asset{}, err
	}

	digest := sha256.Sum256(normalized)
	existing, findErr := s.store.FindReadyByDigest(
		ctx,
		ownerID,
		PurposeImage,
		digest[:],
	)
	if findErr == nil {
		return withDeliveryURLs(existing), nil
	}
	if !errors.Is(findErr, ErrNotFound) {
		return Asset{}, findErr
	}

	id, err := randomUUID()
	if err != nil {
		return Asset{}, fmt.Errorf("generate media asset id: %w", err)
	}
	storageBase := strings.ReplaceAll(id, "-", "")
	variants, payloads, err := buildVariants(
		source,
		strings.TrimPrefix(mimeType, "image/"),
		mimeType,
		extension,
		storageBase,
	)
	if err != nil {
		return Asset{}, err
	}

	asset := Asset{
		ID:               id,
		OwnerID:          ownerID,
		Purpose:          PurposeImage,
		StorageKey:       storageBase + extension,
		MimeType:         mimeType,
		Width:            width,
		Height:           height,
		ByteSize:         int64(len(normalized)),
		SHA256:           append([]byte(nil), digest[:]...),
		Status:           StatusProcessing,
		OriginalFilename: normalizeFilename(filename),
		CreatedAt:        time.Now().UTC(),
		Variants:         make(map[string]Variant, len(variants)),
	}
	for _, variant := range variants {
		asset.Variants[variant.Name] = variant
	}

	if err = s.store.CreateProcessing(ctx, asset, variants); err != nil {
		return Asset{}, err
	}

	cleanup := func() {
		_ = s.objects.Delete(ctx, asset.StorageKey)
		for _, variant := range variants {
			_ = s.objects.Delete(ctx, variant.StorageKey)
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

	for _, variant := range variants {
		if err = s.objects.Put(
			ctx,
			variant.StorageKey,
			variant.MimeType,
			payloads[variant.Name],
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

func (s *Service) ResolveOwnedImage(
	ctx context.Context,
	ownerID, assetID string,
) (string, int, int, bool, error) {
	asset, err := s.store.FindReady(ctx, assetID)
	if errors.Is(err, ErrNotFound) {
		return "", 0, 0, false, nil
	}
	if err != nil {
		return "", 0, 0, false, err
	}
	if asset.OwnerID != ownerID || asset.Purpose != PurposeImage {
		return "", 0, 0, false, nil
	}
	return assetContentURL(asset.ID), asset.Width, asset.Height, true, nil
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

func (s *Service) OpenVariant(
	ctx context.Context,
	id, variantName string,
) (Asset, Variant, io.ReadCloser, error) {
	asset, err := s.store.FindReady(ctx, id)
	if err != nil {
		return Asset{}, Variant{}, nil, err
	}
	variant, ok := asset.Variants[variantName]
	if !ok {
		return Asset{}, Variant{}, nil, ErrVariantNotFound
	}
	body, err := s.objects.Open(ctx, variant.StorageKey)
	if err != nil {
		if errors.Is(err, ErrStorageUnavailable) {
			return Asset{}, Variant{}, nil, err
		}
		return Asset{}, Variant{}, nil, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	return withDeliveryURLs(asset), variant, body, nil
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

func (s *Service) ListImages(
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
		PurposeImage,
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
