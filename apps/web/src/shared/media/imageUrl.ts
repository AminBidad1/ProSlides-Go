const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIRST_PARTY_IMAGE_CONTENT_URL =
  /^\/api\/v1\/media\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/content$/i;

const REMOTE_IMAGE_URL = /^https?:\/\//i;

export const isImageAssetId = (value: unknown): boolean =>
  UUID.test(String(value ?? "").trim());

export const imageAssetIdFromContentURL = (value: unknown): string =>
  String(value ?? "").trim().match(FIRST_PARTY_IMAGE_CONTENT_URL)?.[1] ?? "";

export const isFirstPartyImageURL = (value: unknown): boolean =>
  FIRST_PARTY_IMAGE_CONTENT_URL.test(String(value ?? "").trim());

export const isRemoteImageURL = (value: unknown): boolean => {
  const normalized = String(value ?? "").trim();
  if (!REMOTE_IMAGE_URL.test(normalized)) return false;

  try {
    return Boolean(new URL(normalized).hostname);
  } catch {
    return false;
  }
};

export const isOptionalImageURL = (value: unknown): boolean => {
  const normalized = String(value ?? "").trim();
  if (!normalized || FIRST_PARTY_IMAGE_CONTENT_URL.test(normalized)) {
    return true;
  }
  if (!REMOTE_IMAGE_URL.test(normalized)) return false;

  try {
    return Boolean(new URL(normalized).hostname);
  } catch {
    return false;
  }
};
