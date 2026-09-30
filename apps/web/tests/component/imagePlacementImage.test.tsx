import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ImagePlacementImage } from "../../src/shared/media/ImagePlacementImage.tsx";

describe("ImagePlacementImage", () => {
  test("falls back from a missing preferred rendition to the immutable master", () => {
    const onError = vi.fn();
    const assetId = "123e4567-e89b-42d3-a456-426614174050";
    const master = `/api/v1/media/assets/${assetId}/content`;

    render(
      <ImagePlacementImage
        image={{
          url: master,
          assetId,
          width: 1920,
          height: 1080,
          altText: "",
          focalX: 0.25,
          focalY: 0.75,
        }}
        preferred="medium"
        alt="تصویر نمونه"
        onError={onError}
      />,
    );

    const image = screen.getByRole("img", { name: "تصویر نمونه" });
    expect(image.getAttribute("src")).toBe(
      `/api/v1/media/assets/${assetId}/renditions/medium`,
    );
    expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(image.style.objectPosition).toBe("25% 75%");

    fireEvent.error(image);

    expect(image.getAttribute("src")).toBe(master);
    expect(onError).not.toHaveBeenCalled();

    fireEvent.error(image);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
