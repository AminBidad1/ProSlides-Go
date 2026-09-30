package presentations

import (
	"strings"
	"unicode/utf8"
)

const (
	maxStoredImageDimension = 8192
	maxImageAltTextRunes     = 300
)

type ImagePlacement struct {
	ImageURL      string   `json:"image_url"`
	ImageAssetID  string   `json:"image_asset_id,omitempty"`
	ImageWidth    int      `json:"image_width,omitempty"`
	ImageHeight   int      `json:"image_height,omitempty"`
	ImageAltText  string   `json:"image_alt_text,omitempty"`
	ImageFocalX   *float64 `json:"image_focal_x,omitempty"`
	ImageFocalY   *float64 `json:"image_focal_y,omitempty"`
}

func (value ImagePlacement) hasImage() bool {
	return strings.TrimSpace(value.ImageURL) != ""
}

func (value ImagePlacement) validateStored() error {
	imageURL := strings.TrimSpace(value.ImageURL)
	assetID := strings.TrimSpace(value.ImageAssetID)

	if imageURL == "" {
		if assetID != "" ||
			value.ImageWidth != 0 ||
			value.ImageHeight != 0 ||
			strings.TrimSpace(value.ImageAltText) != "" ||
			value.ImageFocalX != nil ||
			value.ImageFocalY != nil {
			return errInvalidSlideDefinition
		}
		return nil
	}

	if utf8.RuneCountInString(imageURL) > 4096 ||
		utf8.RuneCountInString(value.ImageAltText) > maxImageAltTextRunes {
		return errInvalidSlideDefinition
	}

	if (value.ImageFocalX == nil) != (value.ImageFocalY == nil) {
		return errInvalidSlideDefinition
	}
	if value.ImageFocalX != nil &&
		(*value.ImageFocalX < 0 ||
			*value.ImageFocalX > 1 ||
			*value.ImageFocalY < 0 ||
			*value.ImageFocalY > 1) {
		return errInvalidSlideDefinition
	}

	firstPartyID, firstParty := firstPartyImageAssetID(imageURL)
	if assetID == "" {
		if value.ImageWidth != 0 || value.ImageHeight != 0 {
			return errInvalidSlideDefinition
		}
		return nil
	}

	if !validUUID(assetID) ||
		!firstParty ||
		firstPartyID != assetID ||
		value.ImageWidth < 1 ||
		value.ImageHeight < 1 ||
		value.ImageWidth > maxStoredImageDimension ||
		value.ImageHeight > maxStoredImageDimension {
		return errInvalidSlideDefinition
	}
	return nil
}

func (value ImagePlacement) validateAuthoring() error {
	if err := value.validateStored(); err != nil {
		return err
	}

	imageURL := strings.TrimSpace(value.ImageURL)
	if !validOptionalImageURL(imageURL, 4096) {
		return errInvalidSlideDefinition
	}
	if _, firstParty := firstPartyImageAssetID(imageURL); firstParty &&
		strings.TrimSpace(value.ImageAssetID) == "" {
		return errInvalidSlideDefinition
	}
	return nil
}

func firstPartyImageAssetID(value string) (string, bool) {
	value = strings.TrimSpace(value)
	const prefix = "/api/v1/media/assets/"
	const suffix = "/content"
	if !strings.HasPrefix(value, prefix) ||
		!strings.HasSuffix(value, suffix) {
		return "", false
	}
	id := strings.TrimSuffix(
		strings.TrimPrefix(value, prefix),
		suffix,
	)
	return id, validUUID(id)
}

func validOptionalImageURL(value string, maxRunes int) bool {
	if utf8.RuneCountInString(value) > maxRunes {
		return false
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return true
	}
	if _, ok := firstPartyImageAssetID(value); ok {
		return true
	}
	return validOptionalRemoteURL(value, maxRunes)
}

type ContentDefinition struct {
	Title string `json:"title"`
	Text  string `json:"text"`
	ImagePlacement
}
