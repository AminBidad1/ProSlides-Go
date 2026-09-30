import { requestJson } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";

export type MediaAsset = components["schemas"]["MediaAsset"];
type MediaAssetPage = components["schemas"]["MediaAssetPage"];

export const uploadImageAsset = async (
  file: Blob,
  filename = "image",
  signal?: AbortSignal,
): Promise<MediaAsset> => {
  const form = new FormData();
  form.append("file", file, filename);

  return requestJson<MediaAsset>("/media/images", {
    method: "POST",
    body: form,
    signal,
  });
};

export const listImageAssets = async (
  cursor = "",
  limit = 18,
  signal?: AbortSignal,
): Promise<MediaAssetPage> => {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (cursor) params.set("cursor", cursor);

  return requestJson<MediaAssetPage>(
    `/media/images?${params.toString()}`,
    { signal },
  );
};

export const mediaThumbnailUrl = (
  asset: MediaAsset,
): string =>
  asset.renditions.thumbnail?.url ?? asset.url;
