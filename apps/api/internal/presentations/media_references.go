package presentations

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
)

var (
	errInvalidMediaReference = errors.New("invalid media reference")
	errMediaResolverRequired = errors.New("media resolver required")
)

type ImageAssetResolver interface {
	ResolveOwnedImage(
		context.Context,
		string,
		string,
	) (url string, width int, height int, found bool, err error)
}

func resolveImagePlacement(
	ctx context.Context,
	resolver ImageAssetResolver,
	ownerID string,
	placement *ImagePlacement,
) error {
	if placement == nil {
		return nil
	}
	assetID := strings.TrimSpace(placement.ImageAssetID)
	if assetID == "" {
		if _, firstParty := firstPartyImageAssetID(placement.ImageURL); firstParty {
			return errInvalidMediaReference
		}
		return nil
	}
	if !validUUID(assetID) {
		return errInvalidMediaReference
	}
	if resolver == nil {
		return errMediaResolverRequired
	}

	url, width, height, found, err := resolver.ResolveOwnedImage(
		ctx,
		ownerID,
		assetID,
	)
	if err != nil {
		return err
	}
	if !found {
		return errInvalidMediaReference
	}

	placement.ImageURL = url
	placement.ImageAssetID = assetID
	placement.ImageWidth = width
	placement.ImageHeight = height
	return nil
}

func resolveSlideMedia(
	ctx context.Context,
	resolver ImageAssetResolver,
	ownerID string,
	kind string,
	raw json.RawMessage,
) (json.RawMessage, error) {
	switch kind {
	case ItemKindActivity:
		var activity ActivityDefinition
		if err := decodeStrictObject(raw, &activity); err != nil {
			return nil, errInvalidSlideDefinition
		}
		if err := resolveImagePlacement(
			ctx,
			resolver,
			ownerID,
			&activity.Prompt.ImagePlacement,
		); err != nil {
			return nil, err
		}
		for index := range activity.Response.Options {
			if err := resolveImagePlacement(
				ctx,
				resolver,
				ownerID,
				&activity.Response.Options[index].ImagePlacement,
			); err != nil {
				return nil, err
			}
		}
		return normalizeResolvedSlide(kind, activity)

	case "content":
		var value ContentDefinition
		if err := decodeStrictObject(raw, &value); err != nil {
			return nil, errInvalidSlideDefinition
		}
		if err := resolveImagePlacement(
			ctx,
			resolver,
			ownerID,
			&value.ImagePlacement,
		); err != nil {
			return nil, err
		}
		return normalizeResolvedSlide(kind, value)
	default:
		return nil, errInvalidSlideDefinition
	}
}

func normalizeResolvedSlide(
	kind string,
	value any,
) (json.RawMessage, error) {
	resolved, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	_, normalized, err := normalizeSlideDefinition(kind, resolved)
	if err != nil {
		return nil, err
	}
	return normalized, nil
}

func resolvePresentationMedia(
	ctx context.Context,
	resolver ImageAssetResolver,
	ownerID string,
	settings json.RawMessage,
) (json.RawMessage, error) {
	if len(settings) == 0 {
		return settings, nil
	}

	var values map[string]json.RawMessage
	if err := json.Unmarshal(settings, &values); err != nil {
		return nil, errInvalidPresentationSettings
	}

	var assetID string
	if raw, ok := values["background_image_asset_id"]; ok {
		if json.Unmarshal(raw, &assetID) != nil {
			return nil, errInvalidPresentationSettings
		}
		assetID = strings.TrimSpace(assetID)
	}

	var imageURL string
	if raw, ok := values["background_image_url"]; ok {
		if json.Unmarshal(raw, &imageURL) != nil {
			return nil, errInvalidPresentationSettings
		}
		imageURL = strings.TrimSpace(imageURL)
	}

	if assetID == "" {
		if _, firstParty := firstPartyImageAssetID(imageURL); firstParty {
			return nil, errInvalidMediaReference
		}
		return settings, nil
	}

	if resolver == nil {
		return nil, errMediaResolverRequired
	}
	canonicalURL, _, _, found, err := resolver.ResolveOwnedImage(
		ctx,
		ownerID,
		assetID,
	)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, errInvalidMediaReference
	}

	urlJSON, err := json.Marshal(canonicalURL)
	if err != nil {
		return nil, err
	}
	idJSON, err := json.Marshal(assetID)
	if err != nil {
		return nil, err
	}
	values["background_image_url"] = urlJSON
	values["background_image_asset_id"] = idJSON

	resolved, err := json.Marshal(values)
	if err != nil {
		return nil, err
	}
	return resolved, nil
}
