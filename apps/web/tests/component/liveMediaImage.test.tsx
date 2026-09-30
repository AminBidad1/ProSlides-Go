import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LiveMediaImage } from "../../src/modules/live/ui/LiveMediaImage.tsx";

describe("LiveMediaImage", () => {
  test("uses the requested first-party rendition then falls back to master", () => {
    const assetId = "123e4567-e89b-42d3-a456-426614174050";
    const master = `/api/v1/media/assets/${assetId}/content`;

    render(
      <LiveMediaImage
        image={{
          url: master,
          assetId,
          width: 1920,
          height: 1080,
          altText: "نمودار فروش",
          focalX: 0.2,
          focalY: 0.8,
        }}
        preferred="medium"
        alt="متن جایگزین پیش‌فرض"
        className="sample"
      />,
    );

    const image = screen.getByRole("img", { name: "نمودار فروش" });
    expect(image.getAttribute("src")).toBe(
      `/api/v1/media/assets/${assetId}/renditions/medium`,
    );
    expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(image.style.objectPosition).toBe("20% 80%");

    fireEvent.error(image);
    expect(image.getAttribute("src")).toBe(master);

    fireEvent.error(image);
    expect(
      screen.getByRole("img", { name: "نمودار فروش بارگذاری نشد" })
        .textContent,
    ).toContain("تصویر بارگذاری نشد");
  });

  test("keeps external URLs on their original delivery path", () => {
    render(
      <LiveMediaImage
        src="https://example.test/image.jpg"
        preferred="thumbnail"
        alt="تصویر خارجی"
      />,
    );

    expect(
      screen.getByRole("img", { name: "تصویر خارجی" }).getAttribute("src"),
    ).toBe("https://example.test/image.jpg");
  });
});
