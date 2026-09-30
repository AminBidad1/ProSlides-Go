import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesignDraft,
  designDraftEquals,
  designDraftReducer,
  designDraftToUpdate,
  validateDesignDraft,
} from "../src/modules/presentations/editor/model/designDraft.ts";

const presentation = {
  quiz_id: "presentation-1",
  revision: 9,
  access_code: "ABCDE",
  title: "ارائه طراحی",
  quiz_name: "ارائه طراحی",
  background_color: "#ffffff",
  background_image_url: "",
  background_image_asset_id: "",
  background_image_focal_x: 0.5,
  background_image_focal_y: 0.5,
  text_color: "#ffffff",
  accent_color: "#8b5cf6",
  visualization_palette: ["#8b5cf6", "#06b6d4", "#10b981"],
  music_url: "",
  background: {
    color: "#ffffff",
    image: "",
    focal_x: 0.5,
    focal_y: 0.5,
    text_color: "#ffffff",
  },
  slides: [],
  created_at: "2026-09-22T00:00:00Z",
  last_update: "2026-09-22T00:00:00Z",
};

test("design draft normalizes persisted colors to the same readable theme used at runtime", () => {
  const draft = createDesignDraft(presentation);
  assert.equal(draft.backgroundColor, "#ffffff");
  assert.equal(draft.textColor, "#0f172a");
});

test("background and text changes remain contrast-safe in the design draft", () => {
  const draft = createDesignDraft(presentation);
  let state = { baseline: draft, draft };

  state = designDraftReducer(state, {
    type: "background-color",
    value: "#111111",
  });
  assert.equal(state.draft.backgroundColor, "#111111");
  assert.equal(state.draft.textColor, "#ffffff");

  state = designDraftReducer(state, {
    type: "background-color",
    value: "#ffffff",
  });
  state = designDraftReducer(state, {
    type: "text-color",
    value: "#ffffff",
  });
  assert.equal(state.draft.textColor, "#0f172a");
});

test("design image validation accepts HTTP(S) and rejects unsafe or oversized values", () => {
  const draft = createDesignDraft(presentation);

  assert.equal(
    validateDesignDraft({
      ...draft,
      backgroundImageUrl: "https://example.com/background.jpg",
    }).length,
    0,
  );

  assert.ok(
    validateDesignDraft({
      ...draft,
      backgroundImageUrl: "javascript:alert(1)",
    }).some((issue) => issue.code === "background_image_invalid"),
  );

  assert.ok(
    validateDesignDraft({
      ...draft,
      backgroundImageUrl: `https://example.com/${"a".repeat(4_100)}`,
    }).some((issue) => issue.code === "background_image_too_long"),
  );
});


test("design draft accepts and serializes immutable first-party media assets", () => {
  const draft = createDesignDraft(presentation);
  const assetID = "123e4567-e89b-42d3-a456-426614174000";
  const imageURL = `/api/v1/media/assets/${assetID}/content`;

  const state = designDraftReducer(
    { baseline: draft, draft },
    {
      type: "background-image",
      url: imageURL,
      assetId: assetID,
    },
  );

  assert.equal(validateDesignDraft(state.draft).length, 0);
  assert.equal(state.draft.backgroundImageAssetId, assetID);

  const update = designDraftToUpdate(state.draft);
  assert.equal(update.background_image_url, imageURL);
  assert.equal(update.background_image_asset_id, assetID);
});

test("background focal placement is non-destructive, bounded and serialized", () => {
  const draft = createDesignDraft({
    ...presentation,
    background_image_focal_x: 0.2,
    background_image_focal_y: 0.8,
  });
  assert.equal(draft.backgroundImageFocalX, 0.2);
  assert.equal(draft.backgroundImageFocalY, 0.8);

  const moved = designDraftReducer(
    { baseline: draft, draft },
    { type: "background-image-focal", x: 0.37, y: 0.64 },
  ).draft;
  assert.equal(moved.backgroundImageFocalX, 0.37);
  assert.equal(moved.backgroundImageFocalY, 0.64);
  assert.equal(designDraftEquals(draft, moved), false);

  const update = designDraftToUpdate(moved);
  assert.equal(update.background_image_focal_x, 0.37);
  assert.equal(update.background_image_focal_y, 0.64);

  const normalized = designDraftReducer(
    { baseline: moved, draft: moved },
    { type: "background-image-focal", x: 2, y: -1 },
  ).draft;
  assert.equal(normalized.backgroundImageFocalX, 0.5);
  assert.equal(normalized.backgroundImageFocalY, 0.5);
});

test("design dirty comparison and serialization preserve presentation revision", () => {
  const draft = createDesignDraft(presentation);
  assert.equal(designDraftEquals(draft, draft), true);

  const changed = designDraftReducer(
    { baseline: draft, draft },
    { type: "background-color", value: "#312e81" },
  ).draft;

  assert.equal(designDraftEquals(draft, changed), false);

  const update = designDraftToUpdate(changed);
  assert.equal(update.revision, 9);
  assert.equal(update.background_color, "#312e81");
  assert.equal(update.text_color, "#ffffff");
  assert.equal(update.accent_color, "#8b5cf6");
  assert.deepEqual(update.visualization_palette, [
    "#8b5cf6",
    "#06b6d4",
    "#10b981",
  ]);
});

test("theme presets update background, foreground, accent and visualization palette together", async () => {
  const { PRESENTATION_THEME_PRESETS } = await import(
    "../src/shared/styles/presentationTheme.ts"
  );
  const draft = createDesignDraft(presentation);
  const preset = PRESENTATION_THEME_PRESETS.find(
    (item) => item.id === "deep-ocean",
  );
  assert.ok(preset);

  const state = designDraftReducer(
    { baseline: draft, draft },
    { type: "apply-preset", preset },
  );

  assert.equal(state.draft.backgroundColor, preset.background);
  assert.equal(state.draft.textColor, preset.foreground);
  assert.equal(state.draft.accentColor, preset.accent);
  assert.deepEqual(state.draft.visualizationPalette, [...preset.palette]);
});
