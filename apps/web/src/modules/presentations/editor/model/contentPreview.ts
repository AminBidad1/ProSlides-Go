import type { ImagePlacement } from "../../../../shared/media/image.ts";
import {
  validateContentDraft,
  type ContentDraft,
} from "./contentDraft.ts";

type ContentPreviewModel = {
  title: string;
  text: string;
  image: ImagePlacement;
  hasTitle: boolean;
  hasText: boolean;
  hasImage: boolean;
  validationIssueCount: number;
};

export const createContentPreviewModel = (
  draft: ContentDraft,
): ContentPreviewModel => {
  const title = draft.title.trim();
  const text = draft.text.trim();
  const image = draft.image;

  return {
    title,
    text,
    image,
    hasTitle: Boolean(title),
    hasText: Boolean(text),
    hasImage: Boolean(image.url.trim()),
    validationIssueCount: validateContentDraft(draft).length,
  };
};
