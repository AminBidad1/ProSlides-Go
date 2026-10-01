import { imageAssetIdFromContentURL } from "./imageUrl.ts";

export type ImagePlacement = {
  url: string;
  assetId: string;
  width: number;
  height: number;
  altText: string;
  focalX: number;
  focalY: number;
};

export type ImageDelivery = "thumbnail" | "medium" | "large" | "master";

export const IMAGE_ALT_TEXT_MAX_LENGTH = 300;

type ImagePlacementTransport = {
  image_url: string;
  image_asset_id?: string;
  image_width?: number;
  image_height?: number;
  image_alt_text?: string;
  image_focal_x?: number;
  image_focal_y?: number;
};

export const emptyImagePlacement = (): ImagePlacement => ({
  url: "",
  assetId: "",
  width: 0,
  height: 0,
  altText: "",
  focalX: 0.5,
  focalY: 0.5,
});

type ImageAssetReference = {
  id: string;
  url: string;
  width: number;
  height: number;
};

export const imagePlacementFromAsset = (
  asset: ImageAssetReference,
): ImagePlacement => ({
  ...emptyImagePlacement(),
  url: asset.url,
  assetId: asset.id,
  width: asset.width,
  height: asset.height,
});

export const imagePlacementFromExternalUrl = (
  url: string,
): ImagePlacement => ({
  ...emptyImagePlacement(),
  url: url.trim(),
});

export const trimImagePlacement = (
  image: ImagePlacement,
): ImagePlacement => ({
  ...image,
  url: image.url.trim(),
  assetId: image.assetId.trim(),
  altText: image.altText.trim(),
});

const focalValue = (value: unknown): number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1
    ? value
    : 0.5;

const numberValue = (value: unknown): number => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

export const normalizeImagePlacement = (
  value: Record<string, unknown>,
): ImagePlacement => ({
  url: stringValue(value.image_url),
  assetId: stringValue(value.image_asset_id),
  width: numberValue(value.image_width),
  height: numberValue(value.image_height),
  altText: stringValue(value.image_alt_text),
  focalX: focalValue(value.image_focal_x),
  focalY: focalValue(value.image_focal_y),
});

export const imagePlacementToTransport = (
  image: ImagePlacement,
): ImagePlacementTransport => ({
  image_url: image.url.trim(),
  ...(image.assetId.trim()
    ? {
        image_asset_id: image.assetId.trim(),
        image_width: image.width,
        image_height: image.height,
      }
    : {}),
  ...(image.altText.trim()
    ? { image_alt_text: image.altText.trim() }
    : {}),
  ...(
    image.url.trim() &&
    (
      Math.abs(image.focalX - 0.5) > 0.0001 ||
      Math.abs(image.focalY - 0.5) > 0.0001
    )
      ? {
          image_focal_x: image.focalX,
          image_focal_y: image.focalY,
        }
      : {}
  ),
});

export const imagePlacementEquals = (
  left: ImagePlacement,
  right: ImagePlacement,
): boolean =>
  left.url === right.url &&
  left.assetId === right.assetId &&
  left.width === right.width &&
  left.height === right.height &&
  left.altText === right.altText &&
  left.focalX === right.focalX &&
  left.focalY === right.focalY;

const renditionURL = (
  assetId: string,
  variant: Exclude<ImageDelivery, "master">,
): string =>
  `/api/v1/media/assets/${assetId}/renditions/${variant}`;

export const firstPartyImageDeliveryURL = (
  url: string,
  preferred: ImageDelivery,
): string => {
  if (!url || preferred === "master") return url;
  const assetId = imageAssetIdFromContentURL(url);
  return assetId ? renditionURL(assetId, preferred) : url;
};

export const imageDeliveryURL = (
  image: ImagePlacement,
  preferred: ImageDelivery,
): string => {
  if (!image.url || !image.assetId || preferred === "master") {
    return image.url;
  }
  return renditionURL(image.assetId, preferred);
};

