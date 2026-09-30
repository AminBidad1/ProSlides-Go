import { requestJson } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";

export type MediaAsset = components["schemas"]["MediaAsset"];
type MediaAssetPage = components["schemas"]["MediaAssetPage"];

export const uploadBackgroundAsset = async (
  file: Blob,
  thumbnail: Blob,
  filename = "background.jpg",
  signal?: AbortSignal,
): Promise<MediaAsset> => {
  const form = new FormData();
  form.append("file", file, filename);
  form.append(
    "thumbnail",
    thumbnail,
    thumbnail.type === "image/png"
      ? "thumbnail.png"
      : "thumbnail.jpg",
  );

  return requestJson<MediaAsset>("/media/backgrounds", {
    method: "POST",
    body: form,
    signal,
  });
};

export const listBackgroundAssets = async (
  cursor = "",
  limit = 18,
  signal?: AbortSignal,
): Promise<MediaAssetPage> => {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (cursor) params.set("cursor", cursor);

  return requestJson<MediaAssetPage>(
    `/media/backgrounds?${params.toString()}`,
    { signal },
  );
};
