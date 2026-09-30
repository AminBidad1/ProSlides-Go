import { requestJson } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";

type MediaAsset = components["schemas"]["MediaAsset"];

export const uploadBackgroundAsset = async (
  file: Blob,
  filename = "background.jpg",
  signal?: AbortSignal,
): Promise<MediaAsset> => {
  const form = new FormData();
  form.append("file", file, filename);

  return requestJson<MediaAsset>("/media/backgrounds", {
    method: "POST",
    body: form,
    signal,
  });
};
