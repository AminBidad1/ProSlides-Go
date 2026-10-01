import assert from "node:assert/strict";
import test from "node:test";

import {
  imageAssetIdFromContentURL,
  isFirstPartyImageURL,
  isImageAssetId,
  isOptionalImageURL,
  isRemoteImageURL,
} from "../src/shared/media/imageUrl.ts";

const assetId = "123e4567-e89b-42d3-a456-426614174050";
const firstParty = `/api/v1/media/assets/${assetId}/content`;

test("shared image URL policy accepts product-owned and normal remote images", () => {
  assert.equal(isOptionalImageURL(""), true);
  assert.equal(isOptionalImageURL(firstParty), true);
  assert.equal(isOptionalImageURL("https://example.com/image.jpg"), true);
  assert.equal(isOptionalImageURL("http://localhost:8080/image.png"), true);

  assert.equal(isImageAssetId(assetId), true);
  assert.equal(imageAssetIdFromContentURL(firstParty), assetId);
  assert.equal(isFirstPartyImageURL(firstParty), true);
  assert.equal(isRemoteImageURL("https://example.com/image.jpg"), true);
});

test("shared image URL policy rejects unsafe, malformed and lookalike references", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "ftp://example.com/image.png",
    "https:example.com/image.png",
    "/api/v1/media/assets/not-a-uuid/content",
    `/api/v1/media/assets/${assetId}/renditions/large`,
  ]) {
    assert.equal(isOptionalImageURL(value), false, value);
  }

  assert.equal(isImageAssetId("not-a-uuid"), false);
  assert.equal(imageAssetIdFromContentURL("/api/v1/media/assets/not-a-uuid/content"), "");
});
