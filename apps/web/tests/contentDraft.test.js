import assert from "node:assert/strict";
import test from "node:test";

import { emptyImagePlacement } from "../src/shared/media/image.ts";
import {
  contentDraftEquals,
  contentDraftReducer,
  contentDraftToEditorSlide,
  createContentDraft,
  validateContentDraft,
} from "../src/modules/presentations/editor/model/contentDraft.ts";
import { createContentPreviewModel } from "../src/modules/presentations/editor/model/contentPreview.ts";

const slide = {
  slide_id: "content-1",
  revision: 4,
  order: 2,
  item_kind: "content",
  show_leaderboard_after: false,
  question: null,
  title: "عنوان",
  content_text: "متن توضیحی",
  content_image: emptyImagePlacement(),
};

test("content draft owns title text and image without JSON string dirty checks", () => {
  const draft = createContentDraft(slide);
  assert.ok(draft);
  assert.equal(contentDraftEquals(draft, draft), true);

  const changed = contentDraftReducer(
    { baseline: draft, draft },
    { type: "text", value: "متن تازه" },
  ).draft;

  assert.equal(contentDraftEquals(draft, changed), false);
  assert.equal(createContentPreviewModel(changed).text, "متن تازه");
});

test("content draft accepts title-only text-only or image-only slides", () => {
  const draft = createContentDraft(slide);
  assert.ok(draft);

  assert.equal(
    validateContentDraft({ ...draft, title: "فقط عنوان", text: "", image: emptyImagePlacement() }).length,
    0,
  );
  assert.equal(
    validateContentDraft({ ...draft, title: "", text: "فقط متن", image: emptyImagePlacement() }).length,
    0,
  );
  assert.equal(
    validateContentDraft({
      ...draft,
      title: "",
      text: "",
      image: { ...emptyImagePlacement(), url: "https://example.com/image.jpg" },
    }).length,
    0,
  );
  assert.ok(
    validateContentDraft({ ...draft, title: "", text: "", image: emptyImagePlacement() })
      .some((issue) => issue.code === "content_required"),
  );
});

test("content draft validates unicode character limits used by the backend", () => {
  const draft = createContentDraft(slide);
  assert.ok(draft);

  assert.equal(
    validateContentDraft({
      ...draft,
      title: "ع".repeat(120),
      text: "م".repeat(600),
    }).length,
    0,
  );

  assert.ok(
    validateContentDraft({ ...draft, title: "ع".repeat(121) })
      .some((issue) => issue.code === "content_title_too_long"),
  );
  assert.ok(
    validateContentDraft({ ...draft, text: "م".repeat(601) })
      .some((issue) => issue.code === "content_text_too_long"),
  );
});

test("content serialization preserves authored whitespace and slide revision", () => {
  const draft = createContentDraft(slide);
  assert.ok(draft);

  const changed = {
    ...draft,
    title: "  عنوان با فاصله  ",
    text: "  خط اول\nخط دوم  ",
  };
  const serialized = contentDraftToEditorSlide(changed);

  assert.equal(serialized.revision, 4);
  assert.equal(serialized.title, "  عنوان با فاصله  ");
  assert.equal(serialized.content_text, "  خط اول\nخط دوم  ");
  assert.equal(serialized.item_kind, "content");
  assert.equal(serialized.activity_kind, undefined);
  assert.equal(serialized.question, null);
});


test("content draft preserves reusable image identity across edits", () => {
  const assetId = "123e4567-e89b-42d3-a456-426614174021";
  const image = {
    ...emptyImagePlacement(),
    url: `/api/v1/media/assets/${assetId}/content`,
    assetId,
    width: 1200,
    height: 800,
    altText: "تصویر محتوا",
    focalX: 0.4,
    focalY: 0.6,
  };
  const draft = createContentDraft({
    ...slide,
    content_image: image,
  });
  assert.ok(draft);

  const changed = { ...draft, text: "متن ویرایش‌شده" };
  const serialized = contentDraftToEditorSlide(changed);
  assert.deepEqual(serialized.content_image, image);
});
