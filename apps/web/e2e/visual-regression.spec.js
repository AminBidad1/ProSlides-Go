import { expect, test } from "@playwright/test";

async function settleVisualSurface(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(150);
}

test("landing desktop responsive layout contract", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await settleVisualSurface(page);

  await expect(page.locator("#live-demo")).toBeVisible();
  await expect(page.locator("#landing-product-scene")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const journey = page.locator("#journey");
  await expect(journey.getByRole("button", { name: "ساخت", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await journey.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(journey.getByRole("button", { name: "اجرا", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(journey.getByText("صفحه ارائه · نظرسنجی", { exact: true })).toBeVisible();
});

test("landing mobile responsive layout contract", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await settleVisualSurface(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const liveDemo = page.locator("#live-demo");
  const liveDemoBox = await liveDemo.boundingBox();
  expect(liveDemoBox).not.toBeNull();
  expect(liveDemoBox.width).toBeLessThanOrEqual(390);

  const participantSurface = liveDemo.locator('[data-live-demo-surface="participant"]');
  const stageSurface = liveDemo.locator('[data-live-demo-surface="stage"]');
  const [participantBox, stageBox] = await Promise.all([
    participantSurface.boundingBox(),
    stageSurface.boundingBox(),
  ]);
  expect(participantBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(participantBox.y).toBeLessThan(stageBox.y);

  const journey = page.locator("#journey");
  const productScene = journey.locator("#landing-product-scene");
  await expect(productScene).toHaveCount(1);

  const buildButton = journey.getByRole("button", { name: "ساخت", exact: true });
  await expect(buildButton).toHaveAttribute("aria-pressed", "true");
  await journey.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 500);
  await expect(buildButton).toHaveAttribute("aria-pressed", "true");

  for (const name of ["ساخت", "ورود", "اجرا", "گزارش"]) {
    const button = journey.getByRole("button", { name, exact: true });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await journey.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(journey.getByText("AB12C", { exact: true }).first()).toBeVisible();

  const documentHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  expect(documentHeight).toBeLessThan(7200);
});


test("public and identity surfaces reflow at 320 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });

  for (const path of ["/", "/auth", "/reset-password"]) {
    await page.goto(path);
    await settleVisualSurface(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test("landing tolerates WCAG text-spacing overrides", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await settleVisualSurface(page);

  await page.addStyleTag({
    content: `
      :where(p, li, label, input, textarea, button, a, span) {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p { margin-block-end: 2em !important; }
    `,
  });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("link", { name: "رایگان شروع کنید" })).toBeVisible();
  await expect(page.locator("#live-demo")).toBeVisible();
});

test("authentication mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth");
  await settleVisualSurface(page);

  await expect(page).toHaveScreenshot("auth-mobile.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.002,
  });
});

test("participant join mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(
    "**/api/v1/live/sessions/resolve?join_code=VISUAL1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session_id: "11111111-1111-4111-8111-111111111111",
          presentation_id: "22222222-2222-4222-8222-222222222222",
          presentation: {
            title: "آزمون تصویری پایدار",
            background_color: "#0f766e",
            background_image_url: "",
            music_url: "",
            text_color: "#ffffff",
          },
        }),
      });
    },
  );

  await page.goto("/VISUAL1");
  await expect(
    page.getByRole("heading", { name: "نامتان را وارد کنید" }),
  ).toBeVisible();
  await settleVisualSurface(page);

  await expect(page).toHaveScreenshot("participant-join-mobile.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.002,
  });
});
