import { Buffer } from "node:buffer";

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectAccessible(page, context) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    `${context}: ${results.violations.map(({ id }) => id).join(", ")}`,
  ).toEqual([]);
}

async function expectNoOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function expectNoDocumentScroll(page) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(overflow.width, "document must not scroll horizontally").toBeLessThanOrEqual(0);
  expect(overflow.height, "projected live surface must not scroll vertically").toBeLessThanOrEqual(0);
}

async function expectProjectorViewports(page) {
  const previousViewport = page.viewportSize();
  const projectorViewports = [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
  ];

  try {
    for (const viewport of projectorViewports) {
      await page.setViewportSize(viewport);
      await expectNoDocumentScroll(page);
    }
  } finally {
    if (previousViewport) {
      await page.setViewportSize(previousViewport);
    }
  }
}

async function expectResponsiveSurface(page, assertSurface) {
  const previousViewport = page.viewportSize();
  const viewports = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ];

  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await assertSurface();
      await expectNoOverflow(page);
    }
  } finally {
    if (previousViewport) {
      await page.setViewportSize(previousViewport);
    }
  }
}

function waitForReportSessions(page, presentationId) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === `/api/v1/presentations/${presentationId}/sessions` &&
      response.request().method() === "GET"
    );
  });
}

function choiceActivityContent({
  title = "",
  text,
  selection = "single",
  durationSeconds = 30,
  minPoints = 0,
  maxPoints = 100,
  speedBonus = false,
  partialCredit = false,
  showOverallLeaderboardAfter = false,
  options,
}) {
  return {
    schema_version: 1,
    activity_kind: "choice",
    prompt: { title, text, image_url: "" },
    response: {
      selection,
      options: options.map((option, index) => ({
        id: option.id,
        text: option.text,
        image_url: "",
        order: index + 1,
      })),
    },
    evaluation: {
      mode: "correctness",
      correct_option_ids: options
        .filter((option) => option.isCorrect)
        .map((option) => option.id),
    },
    scoring: {
      mode: "points",
      min_points: minPoints,
      max_points: maxPoints,
      speed_bonus: speedBonus,
      partial_credit: partialCredit,
    },
    timing: { duration_seconds: durationSeconds },
    results: {
      show_overall_leaderboard_after: showOverallLeaderboardAfter,
    },
  };
}


function wordCloudActivityContent({
  title = "",
  text,
  durationSeconds = 60,
  maxEntries = 3,
  maxEntryLength = 30,
}) {
  return {
    schema_version: 1,
    activity_kind: "text",
    prompt: { title, text, image_url: "" },
    response: {
      max_entry_length: maxEntryLength,
      max_entries: maxEntries,
    },
    evaluation: { mode: "none" },
    scoring: { mode: "none" },
    timing: { duration_seconds: durationSeconds },
    results: {
      aggregation: "entry_frequency",
      show_overall_leaderboard_after: false,
    },
  };
}

async function expectReportRouteReady(page, failures) {
  const backLink = page.getByLabel("بازگشت به پنل مدیریت");

  try {
    await expect(backLink).toBeVisible({ timeout: 15_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      url: window.location.href,
      readyState: document.readyState,
      bodyText: document.body.innerText.slice(0, 4_000),
      rootHtml: document.querySelector("#root")?.innerHTML.slice(0, 4_000) || "",
      hasManagerShell: Boolean(
        document.querySelector('[data-manager-shell="protected"]'),
      ),
      resources: performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter(
          (name) =>
            name.includes("ReportRoute") ||
            name.includes("/src/app/") ||
            name.includes("/src/modules/reports/"),
        )
        .slice(-20),
    }));
    console.info(
      "[report-route-diagnostic]",
      JSON.stringify({ ...diagnostic, failures }),
    );
    throw error;
  }
}

function watchRuntime(page) {
  const failures = [];

  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (
      url.origin === "http://127.0.0.1:4173" &&
      request.failure()?.errorText !== "net::ERR_ABORTED"
    ) {
      failures.push(
        `request: ${request.method()} ${request.url()} (${request.failure()?.errorText})`,
      );
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin === "http://127.0.0.1:4173" &&
      response.status() >= 500
    ) {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });

  return failures;
}

test("landing, protected navigation, and responsive auth layout @critical", async ({ page }) => {
  const failures = watchRuntime(page);

  await page.addInitScript(() => {
    window.__f5Vitals = { cls: 0, lcp: 0 };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__f5Vitals.lcp = entries.at(-1)?.startTime || 0;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__f5Vitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/ProSlides|پرو اسلایدز/i);
  await expect(page.locator("body")).toBeVisible();
  await expectAccessible(page, "landing");

  const liveDemo = page.locator("#live-demo");
  await expect(liveDemo).toBeVisible();
  await expect(liveDemo.getByText("نمای مخاطب", { exact: true })).toBeVisible();
  await expect(liveDemo.getByText("صفحه ارائه", { exact: true })).toBeVisible();
  await expect(liveDemo.getByText("موبایل مخاطب", { exact: true })).toHaveCount(0);
  await expect(
    liveDemo.getByText("ابتدا در نمای مخاطب یک گزینه را انتخاب کنید.", { exact: true }),
  ).toBeVisible();
  const firstOption = liveDemo.getByRole("button", { name: "مشارکت مخاطب", exact: true });
  await firstOption.click();
  await expect(firstOption).toHaveAttribute("aria-pressed", "true");
  await expect(liveDemo.getByText("پاسخ ثبت شد ✓", { exact: true })).toBeVisible();
  await expect(
    liveDemo.getByText("حالا نتیجه را برای مخاطبان نمایش دهید.", { exact: true }),
  ).toBeVisible();
  await expect(liveDemo.getByRole("button", { name: "نمایش نتیجه" })).toBeVisible();
  await expect(liveDemo.getByText("نتیجه نظرسنجی", { exact: true })).toHaveCount(0);
  await liveDemo.getByRole("button", { name: "نمایش نتیجه" }).click();
  await expect(liveDemo.getByText("نتیجه نظرسنجی", { exact: true })).toBeVisible();
  await expect(liveDemo.getByText("۱۰ پاسخ ثبت‌شده", { exact: true })).toBeVisible();
  await expect(liveDemo.getByRole("button", { name: "دوباره امتحان کنید" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "ابر واژه", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "کوئیز", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "نظرسنجی", exact: true })).toBeVisible();

  const journey = page.locator("#journey");
  await journey.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(journey.getByText("AB12C", { exact: true }).first()).toBeVisible();
  await expectAccessible(page, "landing-interactions");

  const joinCode = page.getByRole("textbox", { name: "کد ورود" });
  await joinCode.fill("۱۲۳۴A");
  await expect(joinCode).toHaveValue("1234A");
  await joinCode.fill("ABC");
  await joinCode.press("Enter");
  await expect(page.getByRole("alert")).toContainText("۵ تا ۱۲");

  await page.waitForTimeout(500);
  const vitals = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0,
    lcp: window.__f5Vitals.lcp,
    cls: window.__f5Vitals.cls,
  }));
  expect(vitals.fcp).toBeLessThanOrEqual(2000);
  expect(vitals.lcp).toBeLessThanOrEqual(2500);
  expect(vitals.cls).toBeLessThanOrEqual(0.1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => document.getAnimations().filter(({ playState }) => playState === "running").length,
    ),
  ).toBe(0);

  await expectResponsiveSurface(page, async () => {
    await expect(page.getByRole("heading", {
      name: "ارائه‌ای بسازید که مخاطب فقط تماشاگر آن نباشد",
    })).toBeVisible();
    await expect(page.locator("#live-demo")).toBeVisible();
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "ورود با کد", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "کد ورود" }).last()).toBeVisible();
  await expectNoOverflow(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/team");
  await expect(page.getByRole("heading", { name: "تیم ProSlides", exact: true })).toBeVisible();
  const teamList = page.getByRole("list", { name: "اعضای تیم ProSlides" });
  await expect(teamList).toBeVisible();
  await expect(teamList.getByRole("listitem")).toHaveCount(7);
  await expect(teamList.getByText("مهندس بک‌اند", { exact: true }).first()).toBeVisible();
  await expect(teamList.getByText("مهندس فرانت‌اند", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("backend فعال ProSlides اکنون بر Go استوار است", { exact: false }),
  ).toHaveCount(0);

  const teamHeadingBounds = await page
    .getByRole("heading", { name: "تیم ProSlides", exact: true })
    .boundingBox();
  const teamNavLink = page.getByRole("link", { name: "تیم ما", exact: true });
  await expect(teamNavLink).toHaveAttribute("aria-current", "page");
  const teamNavBounds = await teamNavLink.boundingBox();
  expect(teamHeadingBounds).not.toBeNull();
  expect(teamNavBounds).not.toBeNull();
  const headingCenter = teamHeadingBounds.x + teamHeadingBounds.width / 2;
  const navCenter = teamNavBounds.x + teamNavBounds.width / 2;
  expect(Math.abs(headingCenter - navCenter)).toBeLessThanOrEqual(1);

  await expectAccessible(page, "team");
  await page.setViewportSize({ width: 375, height: 812 });
  await expectNoOverflow(page);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/manager/panel");
  await expect(page).toHaveURL(/\/auth\?from=%2Fmanager%2Fpanel$/);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expectAccessible(page, "authentication");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await expectNoOverflow(page);
  expect(failures).toEqual([]);
});

test("register, create a presentation, and open its report @critical", async ({ page }) => {
  const failures = watchRuntime(page);
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `browser-${unique}@example.com`;

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("Browser Test User");

  const registration = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/auth/register") &&
      response.request().method() === "POST",
  );
  await page.locator('button[type="submit"]').click();
  expect((await registration).status()).toBe(201);
  await expect(page).toHaveURL(/\/manager\/panel$/);
  await expectAccessible(page, "dashboard");
  await expect(page.getByRole("heading", { name: "ارائه‌های من" })).toBeVisible();
  await expectResponsiveSurface(page, async () => {
    await expect(page.getByRole("heading", { name: "ارائه‌های من" })).toBeVisible();
  });

  let createRequestCount = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/v1/presentations") &&
      request.method() === "POST"
    ) {
      createRequestCount += 1;
    }
  });
  const createRequest = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/presentations") &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "ارائه جدید" }).click();
  expect((await createRequest).status()).toBe(201);
  await expect(page).toHaveURL(/\/manager\/panel\/[^/]+$/);
  await expectAccessible(page, "empty editor");
  await expectNoOverflow(page);
  expect(createRequestCount).toBe(1);
  await expect(page.getByRole("heading", { name: "اولین آیتم را بسازید" })).toBeVisible();
  await expect(page.getByRole("button", { name: "اجرا", exact: true })).toBeVisible();
  await expectResponsiveSurface(page, async () => {
    await expect(page.getByRole("heading", { name: "اولین آیتم را بسازید" })).toBeVisible();
    await expect(page.getByRole("button", { name: "اجرا", exact: true })).toBeVisible();
  });

  await page.setViewportSize({ width: 1024, height: 700 });
  await expectNoOverflow(page);
  await expect(page.locator('[data-editor-region="item-rail"]')).toHaveCount(0);
  const compactToolbarBounds = await page
    .getByLabel("ابزارهای ویرایشگر")
    .boundingBox();
  expect(compactToolbarBounds).not.toBeNull();
  expect(compactToolbarBounds.width).toBeGreaterThan(900);

  await page.setViewportSize({ width: 1366, height: 640 });
  await expectNoOverflow(page);
  await expect(page.locator('[data-editor-region="item-rail"]')).toBeVisible();
  const editorBounds = await page.locator('[data-editor-shell="v2"]').boundingBox();
  expect(editorBounds).not.toBeNull();
  expect(editorBounds.y).toBeGreaterThanOrEqual(0);
  expect(editorBounds.height).toBeLessThanOrEqual(640);
  await expect(page.getByRole("button", { name: "اجرا", exact: true })).toBeVisible();
  await expect(
    page
      .locator('[data-editor-region="canvas"]')
      .getByRole("button", { name: "اجرا", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 800 });

  let createSlideRequestCount = 0;
  page.on("request", (request) => {
    if (
      /\/api\/v1\/presentations\/[^/]+\/slides$/.test(new URL(request.url()).pathname) &&
      request.method() === "POST"
    ) {
      createSlideRequestCount += 1;
    }
  });
  await page.getByRole("button", { name: "ساخت اولین آیتم" }).click();
  const itemTypeDialog = page.getByRole("dialog", {
    name: "نوع آیتم را انتخاب کنید",
  });
  const firstTypeChoice = itemTypeDialog.locator(
    '[data-item-type-choice="first"]',
  );
  const singleChoiceType = itemTypeDialog.getByRole("button", {
    name: /تک‌گزینه‌ای/,
  });
  const cancelTypeSelection = itemTypeDialog.getByRole("button", {
    name: "انصراف",
  });
  await expect(itemTypeDialog).toBeVisible();
  await expect(firstTypeChoice).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancelTypeSelection).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstTypeChoice).toBeFocused();
  expect(createSlideRequestCount).toBe(0);

  const createSlideRequest = page.waitForResponse(
    (response) =>
      /\/api\/v1\/presentations\/[^/]+\/slides$/.test(new URL(response.url()).pathname) &&
      response.request().method() === "POST",
  );
  await singleChoiceType.click();
  expect((await createSlideRequest).status()).toBe(201);
  expect(createSlideRequestCount).toBe(1);
  await expect(itemTypeDialog).toBeHidden();

  const questionImageTrigger = page.getByRole("button", {
    name: "افزودن یا تغییر تصویر سؤال",
  });
  await questionImageTrigger.click();
  const imageDialog = page.getByRole("dialog", { name: "تصویر سؤال" });
  const imageUrlInput = imageDialog.getByRole("textbox", {
    name: "آدرس تصویر",
  });
  await expect(imageDialog).toBeVisible();
  await expect(imageUrlInput).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(imageDialog).toBeHidden();
  await expect(questionImageTrigger).toBeFocused();

  const changeTypeButton = page.getByRole("button", { name: "تغییر نوع آیتم" });
  await changeTypeButton.click();
  await expect(itemTypeDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(itemTypeDialog).toBeHidden();
  await expect(changeTypeButton).toBeFocused();

  const shareTrigger = page.getByRole("button", { name: "اشتراک‌گذاری" });
  await shareTrigger.click();
  const shareDialog = page.getByRole("dialog", { name: "اشتراک‌گذاری ارائه" });
  const accessCodeInput = shareDialog.getByRole("textbox", {
    name: "کد ورود ارائه",
  });
  await expect(shareDialog).toBeVisible();
  await expect(accessCodeInput).toBeFocused();
  await expectAccessible(page, "share dialog");
  await page.keyboard.press("Escape");
  await expect(shareDialog).toBeHidden();
  await expect(shareTrigger).toBeFocused();

  const presentationId = new URL(page.url()).pathname.split("/").at(-1);
  const firstReportSessions = waitForReportSessions(page, presentationId);
  await page.goto(`/manager/panel/${presentationId}/report`, {
    waitUntil: "domcontentloaded",
  });
  expect((await firstReportSessions).status()).toBe(200);
  await expect(page).toHaveURL(
    new RegExp(`/manager/panel/${presentationId}/report$`),
  );
  await expectReportRouteReady(page, failures);
  await expectAccessible(page, "report");
  await expectResponsiveSurface(page, async () => {
    await expect(page.getByLabel("بازگشت به پنل مدیریت")).toBeVisible();
  });

  let holdNextPresentationRead = true;
  let releaseEditorRead;
  let markEditorReadHeld;
  const editorReadHold = new Promise((resolve) => {
    releaseEditorRead = resolve;
  });
  const editorReadHeld = new Promise((resolve) => {
    markEditorReadHeld = resolve;
  });

  await page.route(
    `**/api/v1/presentations/${presentationId}`,
    async (route) => {
      if (route.request().method() !== "GET" || !holdNextPresentationRead) {
        await route.continue();
        return;
      }

      holdNextPresentationRead = false;
      markEditorReadHeld();
      await editorReadHold;
      await route.continue().catch(() => {});
    },
  );

  await page.goto(`/manager/panel/${presentationId}`, {
    waitUntil: "domcontentloaded",
  });
  await editorReadHeld;
  const reportUrl = new RegExp(`/manager/panel/${presentationId}/report$`);
  const reportNavigation = page.goto(
    `/manager/panel/${presentationId}/report`,
    { waitUntil: "domcontentloaded" },
  );
  try {
    // The new document commit happens after the editor's pagehide handler has
    // aborted the active read. Release the Playwright-held request at that
    // boundary instead of keeping an old-document interception alive through
    // the report application's bootstrap.
    await page.waitForURL(reportUrl, { waitUntil: "commit" });
  } finally {
    releaseEditorRead();
  }
  await reportNavigation;
  await page.unroute(`**/api/v1/presentations/${presentationId}`);

  // The first report navigation above already proves the Session-history API
  // contract. This transition specifically protects the editor pagehide/abort
  // boundary, so assert the user-visible report bootstrap instead of requiring
  // a second uncached GET that the browser is free to satisfy from cache.
  await expect(page).toHaveURL(reportUrl);
  await expectReportRouteReady(page, failures);

  await page.goBack();
  await expect(page).toHaveURL(/\/manager\/panel\/[^/]+$/);
  await page.goForward();
  await expect(page.getByLabel("بازگشت به پنل مدیریت")).toBeVisible();

  await page.goto("/manager/panel");
  await page.locator('button[aria-label="باز کردن منوی حساب"]:visible').click();
  await page.getByRole("menuitem", { name: "خروج از حساب" }).click();
  await expect(page).toHaveURL(/\/auth$/);

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);
  await expect(page.getByRole("heading", { name: "ارائه‌های من" })).toBeVisible();
  expect(failures).toEqual([]);
});

test("an unknown join code shows the access-denied state", async ({ page }) => {
  const failures = watchRuntime(page);
  const resolution = page.waitForResponse((response) =>
    response.url().includes("/api/v1/live/sessions/resolve"),
  );

  const validButUnknownCode = `MISS${Date.now().toString().slice(-8)}`;
  await page.goto(`/${validButUnknownCode}`);
  expect((await resolution).status()).toBe(404);
  await expect(page.getByText("کد ورود معتبر نیست")).toBeVisible();
  await expectAccessible(page, "unknown access code");
  expect(failures).toEqual([]);
});

test("mobile participant entry uses the public quiz theme", async ({ page }) => {
  const failures = watchRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/live/sessions/resolve?join_code=THEME1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "11111111-1111-4111-8111-111111111111",
        presentation_id: "22222222-2222-4222-8222-222222222222",
        presentation: {
          title: "مسابقه رنگ‌ها",
          background_color: "#0f766e",
          background_image_url: "",
          music_url: "",
          text_color: "#ffffff",
        },
      }),
    });
  });

  await page.goto("/THEME1");
  await expect(page.getByRole("heading", { name: "نامتان را وارد کنید" })).toBeVisible();
  await expect(page.getByText("مسابقه رنگ‌ها")).toBeVisible();
  expect(await page.locator(".participant-live-shell").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(15, 118, 110)");
  await expectNoOverflow(page);
  await expectAccessible(page, "themed participant join");
  expect(failures).toEqual([]);
});


test("entry Word Cloud closes and reveals without destabilizing live state @critical", async ({ page }) => {
  test.setTimeout(60_000);
  const failures = watchRuntime(page);
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `word-cloud-live-${unique}@example.com`;
  const activityContent = wordCloudActivityContent({
    title: "جمع‌بندی",
    text: "جلسه را با چند عبارت کوتاه توصیف کنید",
  });

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("Word Cloud Browser Test");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const result = await page.evaluate(async ({ activityContent }) => {
    const cookieValue = (name) => {
      const prefix = `${encodeURIComponent(name)}=`;
      const item = document.cookie
        .split("; ")
        .find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const requestId = () => crypto.randomUUID();
    const api = async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("Content-Type", "application/json");
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
      const response = await fetch(`/api/v1${path}`, {
        method: options.method || "GET",
        credentials: "include",
        headers,
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          `${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`,
        );
      }
      return body;
    };

    const presentation = await api("/presentations", {
      method: "POST",
      body: { title: "Word Cloud close regression", settings: {} },
    });
    const slide = await api(`/presentations/${presentation.id}/slides`, {
      method: "POST",
      headers: { "If-Match": String(presentation.revision) },
      body: {
        position: 0,
        kind: "activity",
        content: activityContent,
      },
    });
    const session = await api("/live/sessions", {
      method: "POST",
      body: {
        request_id: requestId(),
        presentation_id: presentation.id,
      },
    });
    const started = await api(`/live/sessions/${session.id}/actions`, {
      method: "POST",
      body: {
        request_id: requestId(),
        expected_state_version: session.state_version,
        action: "start",
      },
    });
    const presented = await api(`/live/sessions/${session.id}/actions`, {
      method: "POST",
      body: {
        request_id: requestId(),
        expected_state_version: started.state_version,
        action: "present_item",
        item_id: slide.id,
      },
    });

    await api(`/live/sessions/${session.id}/join`, {
      method: "POST",
      body: {
        request_id: requestId(),
        display_name: "Word Cloud Participant",
        avatar: "W",
      },
    });
    await api(`/live/sessions/${session.id}/answers`, {
      method: "POST",
      body: {
        request_id: requestId(),
        activity_item_id: slide.id,
        response: {
          entries: ["هوش مصنوعی", "کار تیمی"],
        },
      },
    });

    const closed = await api(`/live/sessions/${session.id}/actions`, {
      method: "POST",
      body: {
        request_id: requestId(),
        expected_state_version: presented.state_version,
        action: "close_activity",
      },
    });
    const closedSnapshot = await api(
      `/live/sessions/${session.id}/snapshot?viewer=manager`,
    );

    const csrf = cookieValue("proslides_csrf");
    const moderationHeaders = {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    };

    // Hide and reveal intentionally race on the same state version. The
    // session row lock + optimistic state version must allow exactly one
    // command to commit and force the loser to resynchronize with 409.
    let moderationBody = {
      request_id: requestId(),
      expected_state_version: closed.state_version,
      activity_item_id: slide.id,
      // Arabic yeh intentionally verifies that moderation uses the same
      // canonicalization policy as accepted Word Cloud responses.
      canonical_key: "هوش مصنوعي",
      hidden: true,
    };
    const [raceModerationResponse, raceRevealResponse] = await Promise.all([
      fetch(`/api/v1/live/sessions/${session.id}/word-cloud/moderation`, {
        method: "POST",
        credentials: "include",
        headers: moderationHeaders,
        body: JSON.stringify(moderationBody),
      }),
      fetch(`/api/v1/live/sessions/${session.id}/actions`, {
        method: "POST",
        credentials: "include",
        headers: moderationHeaders,
        body: JSON.stringify({
          request_id: requestId(),
          expected_state_version: closed.state_version,
          action: "reveal_activity",
        }),
      }),
    ]);
    const raceStatuses = [
      raceModerationResponse.status,
      raceRevealResponse.status,
    ].sort((left, right) => left - right);
    const raceModerationPayload = await raceModerationResponse
      .json()
      .catch(() => null);

    const afterRace = await api(
      `/live/sessions/${session.id}/snapshot?viewer=manager`,
    );

    let moderated = raceModerationResponse.ok
      ? raceModerationPayload
      : null;
    if (!moderated) {
      moderationBody = {
        ...moderationBody,
        request_id: requestId(),
        expected_state_version: afterRace.session.state_version,
      };
      moderated = await api(
        `/live/sessions/${session.id}/word-cloud/moderation`,
        { method: "POST", body: moderationBody },
      );
    }

    const duplicateModeration = await api(
      `/live/sessions/${session.id}/word-cloud/moderation`,
      { method: "POST", body: moderationBody },
    );

    const staleResponse = await fetch(
      `/api/v1/live/sessions/${session.id}/word-cloud/moderation`,
      {
        method: "POST",
        credentials: "include",
        headers: moderationHeaders,
        body: JSON.stringify({
          request_id: requestId(),
          expected_state_version: closed.state_version,
          activity_item_id: slide.id,
          canonical_key: "هوش مصنوعی",
          hidden: false,
        }),
      },
    );

    const hiddenManagerSnapshot = await api(
      `/live/sessions/${session.id}/snapshot?viewer=manager`,
    );
    const revealed =
      hiddenManagerSnapshot.session.activity_phase === "revealed"
        ? hiddenManagerSnapshot.session
        : await api(`/live/sessions/${session.id}/actions`, {
            method: "POST",
            body: {
              request_id: requestId(),
              expected_state_version:
                hiddenManagerSnapshot.session.state_version,
              action: "reveal_activity",
            },
          });

    const hiddenStage = await api(`/live/sessions/${session.id}/stage`);
    const hiddenParticipant = await api(
      `/live/sessions/${session.id}/snapshot?viewer=participant`,
    );
    const hiddenReport = await api(
      `/presentations/${presentation.id}/sessions/${session.id}/activities/${slide.id}/results`,
    );

    const restored = await api(
      `/live/sessions/${session.id}/word-cloud/moderation`,
      {
        method: "POST",
        body: {
          request_id: requestId(),
          expected_state_version: revealed.state_version,
          activity_item_id: slide.id,
          canonical_key: "هوش مصنوعی",
          hidden: false,
        },
      },
    );
    const restoredStage = await api(`/live/sessions/${session.id}/stage`);
    const restoredParticipant = await api(
      `/live/sessions/${session.id}/snapshot?viewer=participant`,
    );
    const restoredReport = await api(
      `/presentations/${presentation.id}/sessions/${session.id}/activities/${slide.id}/results`,
    );

    const rehidden = await api(
      `/live/sessions/${session.id}/word-cloud/moderation`,
      {
        method: "POST",
        body: {
          request_id: requestId(),
          expected_state_version: restored.state_version,
          activity_item_id: slide.id,
          canonical_key: "هوش مصنوعی",
          hidden: true,
        },
      },
    );
    await api(`/live/sessions/${session.id}/actions`, {
      method: "POST",
      body: {
        request_id: requestId(),
        expected_state_version: rehidden.state_version,
        action: "end",
      },
    });
    const historicalReport = await api(
      `/presentations/${presentation.id}/sessions/${session.id}/activities/${slide.id}/results`,
    );

    return {
      closedPhase: closed.activity_phase,
      closedTerms: closedSnapshot.activity_result?.payload?.terms ?? [],
      moderationTerms: closedSnapshot.word_cloud_moderation?.terms ?? [],
      moderated,
      duplicateModeration,
      raceStatuses,
      staleStatus: staleResponse.status,
      hiddenManagerTerms:
        hiddenManagerSnapshot.activity_result?.payload?.terms ?? [],
      hiddenModerationTerms:
        hiddenManagerSnapshot.word_cloud_moderation?.terms ?? [],
      revealedPhase: revealed.activity_phase,
      hiddenStageTerms: hiddenStage.activity_result?.payload?.terms ?? [],
      hiddenParticipantTerms:
        hiddenParticipant.activity_result?.payload?.terms ?? [],
      hiddenReportTerms: hiddenReport.result?.payload?.terms ?? [],
      rawReportResponses: hiddenReport.responses ?? [],
      restored,
      restoredStageTerms:
        restoredStage.activity_result?.payload?.terms ?? [],
      restoredParticipantTerms:
        restoredParticipant.activity_result?.payload?.terms ?? [],
      restoredReportTerms: restoredReport.result?.payload?.terms ?? [],
      historicalReportTerms:
        historicalReport.result?.payload?.terms ?? [],
      historicalRawResponses: historicalReport.responses ?? [],
    };
  }, { activityContent });

  expect(result.closedPhase).toBe("closed");
  expect(result.closedTerms).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ text: "هوش مصنوعی", count: 1 }),
      expect.objectContaining({ text: "کار تیمی", count: 1 }),
    ]),
  );
  expect(result.moderationTerms).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        canonical_key: "هوش مصنوعی",
        text: "هوش مصنوعی",
        count: 1,
        hidden: false,
      }),
    ]),
  );

  expect(result.raceStatuses).toEqual([201, 409]);
  expect(result.moderated.canonical_key).toBe("هوش مصنوعی");
  expect(result.moderated.hidden).toBe(true);
  expect(result.duplicateModeration.duplicate).toBe(true);
  expect(result.duplicateModeration.state_version).toBe(
    result.moderated.state_version,
  );
  expect(result.staleStatus).toBe(409);

  expect(result.hiddenManagerTerms).toEqual([
    expect.objectContaining({ text: "کار تیمی", count: 1 }),
  ]);
  expect(result.hiddenModerationTerms).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        canonical_key: "هوش مصنوعی",
        hidden: true,
      }),
    ]),
  );

  expect(result.revealedPhase).toBe("revealed");
  for (const terms of [
    result.hiddenStageTerms,
    result.hiddenParticipantTerms,
    result.hiddenReportTerms,
  ]) {
    expect(terms).toEqual([
      expect.objectContaining({ text: "کار تیمی", count: 1 }),
    ]);
  }
  expect(
    JSON.stringify(result.rawReportResponses),
  ).toContain("هوش مصنوعی");

  expect(result.restored.hidden).toBe(false);
  for (const terms of [
    result.restoredStageTerms,
    result.restoredParticipantTerms,
    result.restoredReportTerms,
  ]) {
    expect(terms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "هوش مصنوعی", count: 1 }),
        expect.objectContaining({ text: "کار تیمی", count: 1 }),
      ]),
    );
  }

  expect(result.historicalReportTerms).toEqual([
    expect.objectContaining({ text: "کار تیمی", count: 1 }),
  ]);
  expect(JSON.stringify(result.historicalRawResponses)).toContain("هوش مصنوعی");
  expect(failures).toEqual([]);
});

test("manager, audience Stage, and participant complete the live lifecycle with reconnect @critical", async ({ browser }) => {
  test.setTimeout(150000);

  // Keep all live surfaces in one browser context on purpose. This models a
  // presenter testing the participant experience in another tab, so manager
  // and participant cookies coexist and every surface must request its own
  // explicit viewer projection.
  const managerContext = await browser.newContext();
  const manager = await managerContext.newPage();
  const stage = await managerContext.newPage();
  const participant = await managerContext.newPage();
  // 1024×768 is the projector baseline for the live projection contract.
  await manager.setViewportSize({ width: 1024, height: 768 });
  await stage.setViewportSize({ width: 1024, height: 768 });
  await participant.setViewportSize({ width: 390, height: 844 });
  manager.setDefaultTimeout(15000);
  stage.setDefaultTimeout(15000);
  participant.setDefaultTimeout(15000);
  const managerFailures = watchRuntime(manager);
  const stageFailures = watchRuntime(stage);
  const participantFailures = watchRuntime(participant);
  const forbiddenStageReads = [];
  stage.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      /\/api\/v1\/live\/sessions\/[^/]+\/(snapshot|roster)$/.test(path)
    ) {
      forbiddenStageReads.push(path);
    }
  });

  try {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `live-browser-${unique}@example.com`;
    const accessCode = `L${Date.now().toString(36).slice(-7)}`.toUpperCase();

    await manager.goto("/signup");
    await manager.locator('input[name="email"]').fill(email);
    await manager.locator('input[name="password"]').fill("BrowserPass!42");
    await manager.locator('input[name="fullName"]').fill("مدیر تست زنده");
    await manager.locator('button[type="submit"]').click();
    await expect(manager).toHaveURL(/\/manager\/panel$/);

    const activityContent = choiceActivityContent({
      title: "پرسش تست",
      text: "پایتخت ایران کدام شهر است؟",
      durationSeconds: 60,
      showOverallLeaderboardAfter: true,
      options: [
        { id: `option-a-${unique}`, text: "تهران", isCorrect: true },
        { id: `option-b-${unique}`, text: "شیراز", isCorrect: false },
      ],
    });

    const fixture = await manager.evaluate(async ({ accessCode, activityContent }) => {
      const cookieValue = (name) => {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const api = async (path, options = {}) => {
        const headers = new Headers(options.headers || {});
        headers.set("Content-Type", "application/json");
        const csrf = cookieValue("proslides_csrf");
        if (csrf) headers.set("X-CSRF-Token", csrf);
        const response = await fetch(`/api/v1${path}`, {
          method: options.method || "GET",
          credentials: "include",
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
        }
        return body;
      };

      const presentation = await api("/presentations", {
        method: "POST",
        body: { title: "چرخه کامل تست زنده", settings: {} },
      });

      const slide = await api(`/presentations/${presentation.id}/slides`, {
        method: "POST",
        headers: { "If-Match": String(presentation.revision) },
        body: {
          position: 0,
          kind: "activity",
          content: activityContent,
        },
      });

      const afterActivity = await api(`/presentations/${presentation.id}`);
      const contentSlide = await api(
        `/presentations/${presentation.id}/slides`,
        {
          method: "POST",
          headers: { "If-Match": String(afterActivity.revision) },
          body: {
            position: 1,
            kind: "content",
            content: {
              title: "نکته بین دو سؤال",
              text: "این متن باید بدون ورود دوباره به حالت اتصال نمایش داده شود.",
              image_url: "",
            },
          },
        },
      );

      await api(`/presentations/${presentation.id}/access-code`, {
        method: "PUT",
        body: { access_code: accessCode },
      });

      return {
        presentationId: presentation.id,
        slideId: slide.id,
        contentSlideId: contentSlide.id,
        accessCode,
      };
    }, { accessCode, activityContent });

    const managerSnapshotPromise = manager.waitForResponse(
      (response) =>
        /\/api\/v1\/live\/sessions\/[^/]+\/snapshot$/.test(
          new URL(response.url()).pathname,
        ) &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await manager.goto(`/manager/presentation/${fixture.presentationId}`);
    const managerSnapshot = await (await managerSnapshotPromise).json();
    const sessionId = managerSnapshot.session.id;

    const startButton = manager.getByRole("button", { name: /شروع/ });
    await expect(startButton).toBeEnabled({ timeout: 15000 });
    await expectAccessible(manager, "manager live lobby");
    await expectNoOverflow(manager);
    await expectProjectorViewports(manager);

    const qrTrigger = manager.getByRole("button", { name: "نمایش QR" });
    await qrTrigger.click();
    const qrDialog = manager.getByRole("dialog", {
      name: "اسکن کنید و وارد شوید",
    });
    const closeQrButton = qrDialog.getByRole("button", {
      name: "بستن کد QR",
    });
    await expect(qrDialog).toBeVisible();
    await expect(closeQrButton).toBeFocused();
    await manager.keyboard.press("Escape");
    await expect(qrDialog).toBeHidden();
    await expect(qrTrigger).toBeFocused();

    const backstageTrigger = manager.getByRole("link", {
      name: "باز کردن پشت‌صحنه خصوصی در پنجره جدا",
    });
    await expect(backstageTrigger).toHaveAttribute(
      "href",
      `/manager/presentation/${fixture.presentationId}?backstage=1`,
    );
    await expect(backstageTrigger).toHaveAttribute("target", "_blank");
    const backstagePagePromise = managerContext.waitForEvent("page");
    await backstageTrigger.click();
    const backstagePage = await backstagePagePromise;
    await backstagePage.setViewportSize({ width: 1180, height: 820 });
    backstagePage.setDefaultTimeout(15000);
    const backstageFailures = watchRuntime(backstagePage);
    const backstage = backstagePage.locator('[data-backstage-surface="presenter"]');
    const backstagePrivacyHeading = backstagePage.getByRole("heading", {
      name: "پیش از نمایش اطلاعات پشت‌صحنه",
    });
    const backstageDialog = backstagePage.getByRole("dialog", {
      name: "پشت‌صحنه",
    });
    const armBackstage = async () => {
      await expect(backstagePrivacyHeading).toBeVisible({ timeout: 15000 });
      await expect(backstageDialog).toBeHidden();
      await backstagePage
        .getByRole("button", { name: "نمایش پشت‌صحنه خصوصی" })
        .click();
      await expect(backstageDialog).toBeVisible({ timeout: 15000 });
    };

    await armBackstage();
    await expect(
      backstageDialog.getByRole("link", { name: "باز کردن Stage در پنجره جدید" }),
    ).toHaveAttribute("href", `/manager/stage/${sessionId}`);
    await backstagePage.keyboard.press("Escape");
    await expect(backstageDialog).toBeVisible();
    await backstageDialog
      .getByRole("button", { name: "پوشاندن اطلاعات" })
      .click();
    await expect(backstagePrivacyHeading).toBeVisible();
    await expect(backstage).toBeHidden();
    await armBackstage();
    await expect(
      manager.getByRole("dialog", { name: "پشت‌صحنه" }),
    ).toBeHidden();

    await stage.goto(`/manager/stage/${sessionId}`);
    await expect(
      stage.getByRole("heading", { name: "چرخه کامل تست زنده" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      stage.getByRole("main").getByText(fixture.accessCode, { exact: true }),
    ).toBeVisible();
    await expectAccessible(stage, "audience Stage lobby");
    await expectNoOverflow(stage);
    await expectProjectorViewports(stage);

    await participant.goto(`/${fixture.accessCode}`);
    await expect(participant.getByRole("heading", { name: "نامتان را وارد کنید" })).toBeVisible();
    await expectAccessible(participant, "participant live join");
    await expectNoOverflow(participant);
    await participant.getByLabel("نام نمایشی").fill("شرکت‌کننده تست");
    await participant.getByRole("button", { name: "پیوستن به جلسه" }).click();
    await expect(participant.getByRole("heading", { name: "شرکت‌کننده تست" })).toBeVisible();
    await expect(
      manager.getByRole("button", { name: "پنهان کردن نام شرکت‌کننده تست" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(stage.getByText("۱ شرکت‌کننده", { exact: true })).toBeVisible({
      timeout: 15000,
    });

    await startButton.click();
    await expect(
      participant.getByRole("heading", { name: "پایتخت ایران کدام شهر است؟" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      manager.getByRole("heading", { name: "پایتخت ایران کدام شهر است؟" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      manager.getByRole("button", { name: "نمایش نتیجه", exact: true }),
    ).toBeVisible();
    await expect(
      stage.getByRole("heading", { name: "پایتخت ایران کدام شهر است؟" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(stage.getByText("پاسخ صحیح", { exact: true })).toBeHidden();
    await expectAccessible(participant, "participant live activity");
    await expectNoOverflow(participant);
    await expectNoOverflow(stage);
    await expectProjectorViewports(manager);
    await expectProjectorViewports(stage);

    const answerRequestIds = [];
    let failNextAnswer = true;
    let acceptedAnswerStatus = null;
    await participant.route("**/api/v1/live/sessions/*/answers", async (route) => {
      const body = route.request().postDataJSON();
      answerRequestIds.push(body.request_id);
      if (failNextAnswer) {
        failNextAnswer = false;
        await route.fulfill({
          status: 418,
          contentType: "application/json",
          body: JSON.stringify({
            error: "temporary_answer_failure",
            message: "temporary answer failure",
          }),
        });
        return;
      }

      const response = await route.fetch();
      acceptedAnswerStatus = response.status();
      await route.fulfill({ response });
    });

    const tehranOption = participant.getByRole("button", { name: /تهران/ });
    await tehranOption.click();
    await expect(tehranOption).toHaveAttribute("aria-pressed", "true");

    await participant.getByRole("button", { name: "ثبت پاسخ" }).click();
    await expect(
      participant.getByText(
        "ارسال کامل نشد. انتخاب شما حفظ شده است؛ دوباره تلاش کنید.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(tehranOption).toHaveAttribute("aria-pressed", "true");
    await participant
      .getByRole("button", { name: "تلاش دوباره برای ارسال" })
      .click();
    await expect(
      participant.getByText("پاسخ ثبت شد ✓", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      participant.getByText("انتخاب شما ذخیره شده است. منتظر نمایش نتیجه بمانید.", {
        exact: true,
      }),
    ).toBeVisible();
    expect([200, 201]).toContain(acceptedAnswerStatus);
    expect(answerRequestIds).toHaveLength(2);
    expect(answerRequestIds[0]).toBe(answerRequestIds[1]);
    await participant.unroute("**/api/v1/live/sessions/*/answers");

    await backstagePage.reload();
    await armBackstage();
    await expect(backstage).toBeVisible({ timeout: 15000 });
    await backstage.getByRole("button", { name: "بستن پاسخ‌گویی" }).click();
    await expect(
      backstage.getByRole("heading", { name: "نتیجه خصوصی فعالیت" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      backstage.getByRole("heading", { name: "برترین‌های این فعالیت" }),
    ).toBeVisible();
    await expect(backstage.getByText("شرکت‌کننده تست")).toBeVisible();
    await expect(backstage.getByText("+۱۰۰", { exact: true })).toBeVisible();
    await expectAccessible(backstagePage, "manager backstage activity result");

    await expect(
      participant.getByText("پاسخ‌گویی پایان یافت", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      participant.getByRole("heading", { name: "پایتخت ایران کدام شهر است؟" }),
    ).toBeVisible();
    await expect(
      participant.getByText("پاسخ شما ثبت شده است", { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByText("نتیجه هنوز نمایش داده نشده است.", { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByText("پاسخ صحیح", { exact: true }),
    ).toBeHidden();
    await expectAccessible(participant, "participant closed activity");
    await expectNoOverflow(participant);

    await participant.reload();
    await expect(
      participant.getByText("پاسخ‌گویی پایان یافت", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      participant.getByText("پاسخ شما ثبت شده است", { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByText("پاسخ صحیح", { exact: true }),
    ).toBeHidden();

    const privateRankingTrigger = backstage.getByRole("button", {
      name: "مشاهده خصوصی رتبه‌بندی کلی",
    });
    await expect(privateRankingTrigger).toBeEnabled();
    await privateRankingTrigger.click();
    const privateRankingDialog = backstagePage.getByRole("dialog", {
      name: "جدول امتیازات",
    });
    const closePrivateRanking = privateRankingDialog.getByRole("button", {
      name: "بستن جدول امتیازات",
    });
    await expect(privateRankingDialog).toBeVisible();
    await expect(closePrivateRanking).toBeFocused();
    await backstagePage.keyboard.press("Escape");
    await expect(privateRankingDialog).toBeHidden();
    await expect(privateRankingTrigger).toBeFocused();

    await expect(
      stage.getByRole("main").getByText("پاسخ صحیح", { exact: true }),
    ).toBeHidden();

    await backstage.getByRole("button", { name: "نمایش نتیجه روی Stage" }).click();
    await expect(
      participant.getByText("نتیجه فعالیت", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      participant.getByText("۱ پاسخ ثبت‌شده", { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByText("پاسخ صحیح", { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByText("انتخاب شما", { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByText("۱۰۰٪", { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByText("امتیاز این فعالیت", { exact: true }),
    ).toBeVisible();
    const stageMain = stage.getByRole("main");
    await expect(
      stageMain.getByText("نتیجه فعالیت", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      stageMain.getByText("۱ پاسخ ثبت‌شده", { exact: true }),
    ).toBeVisible();
    await expect(
      stageMain.getByText("پاسخ صحیح", { exact: true }),
    ).toBeVisible();
    await expectProjectorViewports(stage);

    await backstage.getByRole("button", { name: "پوشاندن اطلاعات" }).click();
    await expect(backstage).toBeHidden();
    await expect(backstagePrivacyHeading).toBeVisible();
    await expectProjectorViewports(manager);
    await backstagePage.reload();
    await armBackstage();
    await expect(backstage).toBeVisible({ timeout: 15000 });

    await stage.reload();
    await expect(
      stage.getByRole("main").getByText("نتیجه فعالیت", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      stage.getByRole("main").getByText("پاسخ صحیح", { exact: true }),
    ).toBeVisible();

    await participant.reload();
    await expect(
      participant.getByText("نتیجه فعالیت", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      participant.getByText("۱ پاسخ ثبت‌شده", { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByText("انتخاب شما", { exact: true }),
    ).toBeVisible();

    await backstage
      .getByRole("button", { name: "نمایش رتبه‌بندی کلی روی Stage" })
      .click();
    await expect(
      participant.getByRole("heading", { name: "امتیاز فعلی شما" }),
    ).toBeVisible({
      timeout: 15000,
    });
    await expect(
      manager
        .getByRole("main")
        .getByText("شرکت‌کننده تست", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      stage.getByRole("heading", { name: "شرکت‌کننده تست" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      stage.getByText("جلسه فعلاً یک شرکت‌کننده دارد؛ رتبه رقابتی نمایش داده نمی‌شود."),
    ).toBeVisible();
    await expectProjectorViewports(stage);

    await participant.reload();
    await expect(
      participant.getByRole("heading", { name: "امتیاز فعلی شما" }),
    ).toBeVisible({
      timeout: 15000,
    });
    await expect(
      participant.getByText("امتیاز شما", { exact: true }),
    ).toBeVisible();

    await backstage
      .getByRole("button", { name: "پوشاندن اطلاعات" })
      .click();
    await expect(backstage).toBeHidden();
    await expect(backstagePrivacyHeading).toBeVisible();
    await expectProjectorViewports(manager);

    await manager.getByRole("button", { name: "آیتم بعدی" }).click();
    await expect(
      participant.getByRole("heading", { name: "نکته بین دو سؤال" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      participant.getByText(
        "این متن باید بدون ورود دوباره به حالت اتصال نمایش داده شود.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      participant.getByText("منتظر مرحله بعدی ارائه‌دهنده بمانید", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      participant.getByText("در حال بازیابی ارتباط", { exact: true }),
    ).toBeHidden();
    await expect(
      participant.getByText("در حال اتصال", { exact: true }),
    ).toBeHidden();
    await expect(
      stage.getByRole("heading", { name: "نکته بین دو سؤال" }),
    ).toBeVisible({ timeout: 15000 });
    await expectAccessible(participant, "participant live content");
    await expectNoOverflow(participant);
    await expectProjectorViewports(manager);
    await expectProjectorViewports(stage);

    await participant.reload();
    await expect(
      participant.getByRole("heading", { name: "نکته بین دو سؤال" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      participant.getByText("در حال بازیابی ارتباط", { exact: true }),
    ).toBeHidden();

    await backstagePage.reload();
    await armBackstage();
    await expect(backstage).toBeVisible({ timeout: 15000 });
    await backstage.getByRole("button", { name: "پایان جلسه", exact: true }).click();
    const endDialog = backstagePage.getByRole("alertdialog");
    await expect(endDialog).toBeVisible();
    await endDialog.getByRole("button", { name: "پایان جلسه", exact: true }).click();
    await expect(
      manager.getByRole("button", { name: "بازگشت به پنل مدیریت" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      participant.getByRole("heading", { name: "نتیجه نهایی شما" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(participant.getByText("جلسه پایان یافت")).toBeVisible();
    await expectProjectorViewports(manager);
    await expect(
      stage.getByRole("heading", { name: "نتیجه انفرادی" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(stage.getByText("شرکت‌کننده تست")).toBeVisible();
    await expectNoOverflow(participant);
    await expectNoOverflow(stage);
    await expectProjectorViewports(stage);

    const endedResolve = participant.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/live/sessions/resolve") &&
        response.request().method() === "GET",
    );
    await participant.reload();
    expect((await endedResolve).status()).toBe(404);
    await expect(
      participant.getByRole("heading", { name: "نتیجه نهایی شما" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(participant.getByText("جلسه پایان یافت")).toBeVisible();
    await expectNoOverflow(participant);

    expect(forbiddenStageReads).toEqual([]);
    expect(managerFailures).toEqual([]);
    expect(stageFailures).toEqual([]);
    expect(participantFailures).toEqual([]);
    expect(backstageFailures).toEqual([]);
  } finally {
    await managerContext.close();
  }
});


test("question editor preserves typed draft semantics across save and edit conflict", async ({ page }) => {
  test.setTimeout(90000);
  const failures = watchRuntime(page);
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `editor-browser-${unique}@example.com`;

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("مدیر تست ویرایشگر");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const activityContent = choiceActivityContent({
    text: "پایتخت ایران کدام است؟",
    showOverallLeaderboardAfter: true,
    options: [
      { id: `option-a-${unique}`, text: "تهران", isCorrect: true },
      { id: `option-b-${unique}`, text: "شیراز", isCorrect: false },
    ],
  });

  const fixture = await page.evaluate(async ({ activityContent }) => {
    const cookieValue = (name) => {
      const prefix = `${encodeURIComponent(name)}=`;
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const api = async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("Content-Type", "application/json");
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
      const response = await fetch(`/api/v1${path}`, {
        method: options.method || "GET",
        credentials: "include",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
      }
      return body;
    };

    const presentation = await api("/presentations", {
      method: "POST",
      body: { title: "تست ویرایشگر سؤال", settings: {} },
    });
    const slide = await api(`/presentations/${presentation.id}/slides`, {
      method: "POST",
      headers: { "If-Match": String(presentation.revision) },
      body: {
        position: 0,
        kind: "activity",
        content: activityContent,
      },
    });

    return {
      presentationId: presentation.id,
      slideId: slide.id,
    };
  }, { activityContent });

  await page.goto(`/manager/panel/${fixture.presentationId}`);
  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "تنظیمات سؤال" });
  await expect(inspector).toBeVisible();
  await expectAccessible(page, "question editor");
  await expect(
    inspector.getByText("از ۵ ثانیه تا ۲۰ دقیقه.", { exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByLabel("حداقل امتیاز پاسخ صحیح"),
  ).toHaveCount(0);
  await expect(
    inspector.getByText("امتیازدهی جزئی", { exact: true }),
  ).toHaveCount(0);

  const speedBonus = inspector.getByRole("checkbox", {
    name: /پاسخ سریع‌تر، امتیاز بیشتر/,
  });
  await speedBonus.check();
  const minPointsInput = inspector.getByLabel("حداقل امتیاز پاسخ صحیح");
  await expect(minPointsInput).toBeVisible();
  await minPointsInput.fill("۱۰۱");
  await speedBonus.uncheck();
  await expect(minPointsInput).toHaveCount(0);

  const preview = page.getByRole("region", { name: "پیش‌نمایش سؤال" });
  await expect(preview).toBeVisible();
  const questionInput = page.getByRole("textbox", { name: "متن سؤال", exact: true });
  const timeInput = page.getByLabel("زمان پاسخ به ثانیه");
  await questionInput.fill("پایتخت ایران را انتخاب کنید");
  await timeInput.fill("۴۵");

  await expect(
    preview.getByText("پایتخت ایران را انتخاب کنید", { exact: true }),
  ).toBeVisible();
  await expect(preview.getByText("۴۵ ثانیه", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "انتقال گزینه ۱ به پایین" }).click();
  await expect(page.getByPlaceholder("متن گزینه ۱")).toHaveValue("شیراز");
  await expect(
    preview.getByRole("article", { name: /گزینه ۱: شیراز/ }),
  ).toBeVisible();
  await expect(
    preview.getByText("تغییرات ذخیره‌نشده", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("تغییرات ذخیره‌نشده دارید.")).toBeVisible();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname.endsWith(
        `/api/v1/presentations/${fixture.presentationId}/slides/${fixture.slideId}`,
      ),
  );
  await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedSlide = await saveResponse.json();
  expect(savedSlide.kind).toBe("activity");
  expect(savedSlide.content.prompt.text).toBe("پایتخت ایران را انتخاب کنید");
  expect(savedSlide.content.timing.duration_seconds).toBe(45);
  expect(savedSlide.content.scoring.speed_bonus).toBe(false);
  expect(savedSlide.content.scoring.min_points).toBe(0);
  expect(savedSlide.content.response.options[0].text).toBe("شیراز");
  expect(savedSlide.content.response.options[0].order).toBe(1);
  await expect(page.getByText("همه تغییرات ذخیره شده است.")).toBeVisible();
  await expect(
    preview.getByText("تغییرات ذخیره‌نشده", { exact: true }),
  ).toBeHidden();

  await questionInput.fill("ویرایش موقت برای رد");
  await expect(
    preview.getByText("ویرایش موقت برای رد", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "بستن تنظیمات سؤال" }).click();
  const discardDialog = page.getByRole("alertdialog");
  await expect(discardDialog).toContainText("تغییرات ذخیره‌نشده این سؤال از بین می‌رود");
  await discardDialog.getByRole("button", { name: "رد تغییرات" }).click();
  await expect(page.getByRole("complementary", { name: "تنظیمات سؤال" })).toBeHidden();
  await expect(
    preview.getByText("پایتخت ایران را انتخاب کنید", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "تنظیمات سؤال" })).toBeVisible();
  await questionInput.fill("نسخه محلی که نباید بی‌صدا از بین برود");
  await expect(
    preview.getByText("نسخه محلی که نباید بی‌صدا از بین برود", { exact: true }),
  ).toBeVisible();

  await page.evaluate(
    async ({ presentationId, slideId, revision, content }) => {
      const cookieValue = (name) => {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const headers = new Headers({
        "Content-Type": "application/json",
        "If-Match": String(revision),
      });
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);

      const response = await fetch(
        `/api/v1/presentations/${presentationId}/slides/${slideId}`,
        {
          method: "PUT",
          credentials: "include",
          headers,
          body: JSON.stringify({
            position: 0,
            kind: "activity",
            content: {
              ...content,
              prompt: {
                ...content.prompt,
                text: "نسخه جدید سرور",
              },
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`external editor mutation failed: ${response.status}`);
      }
    },
    {
      presentationId: fixture.presentationId,
      slideId: fixture.slideId,
      revision: savedSlide.revision,
      content: savedSlide.content,
    },
  );

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.status() === 409 &&
      new URL(response.url()).pathname.endsWith(
        `/api/v1/presentations/${fixture.presentationId}/slides/${fixture.slideId}`,
      ),
  );
  await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
  await conflictResponsePromise;

  await expect(
    page.getByText(/نسخه جدیدتری از این سؤال ذخیره شده است/),
  ).toBeVisible();
  await expect(questionInput).toHaveValue("نسخه محلی که نباید بی‌صدا از بین برود");
  await expect(
    preview.getByText("نسخه محلی که نباید بی‌صدا از بین برود", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "ذخیره تغییرات" })).toBeDisabled();

  await page.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();
  const conflictDialog = page.getByRole("alertdialog");
  await expect(conflictDialog).toBeVisible();
  await expect(conflictDialog).toContainText("تغییرات محلی این پنل از بین می‌رود");
  await conflictDialog.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();

  await expect(page.getByRole("complementary", { name: "تنظیمات سؤال" })).toBeHidden();
  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "متن سؤال", exact: true })).toHaveValue("نسخه جدید سرور");
  await expect(preview.getByText("نسخه جدید سرور", { exact: true })).toBeVisible();

  expect(failures).toEqual([]);
});


test("content editor projects unsaved draft and preserves it across edit conflicts", async ({ page }) => {
  test.setTimeout(90000);
  const failures = watchRuntime(page);
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `content-editor-${unique}@example.com`;

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("مدیر تست محتوای ارائه");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const fixture = await page.evaluate(async () => {
    const cookieValue = (name) => {
      const prefix = `${encodeURIComponent(name)}=`;
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const api = async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("Content-Type", "application/json");
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
      const response = await fetch(`/api/v1${path}`, {
        method: options.method || "GET",
        credentials: "include",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
      }
      return body;
    };

    const presentation = await api("/presentations", {
      method: "POST",
      body: { title: "تست ویرایشگر محتوا", settings: {} },
    });
    const slide = await api(`/presentations/${presentation.id}/slides`, {
      method: "POST",
      headers: { "If-Match": String(presentation.revision) },
      body: {
        position: 0,
        kind: "content",
        content: {
          title: "عنوان اولیه",
          text: "متن اولیه",
          image_url: "",
        },
      },
    });

    return {
      presentationId: presentation.id,
      slideId: slide.id,
    };
  });

  await page.goto(`/manager/panel/${fixture.presentationId}`);
  await page.getByRole("button", { name: "محتوا", exact: true }).click();

  const inspector = page.getByRole("complementary", {
    name: "تنظیمات اسلاید محتوا",
  });
  const preview = page.getByRole("region", {
    name: "پیش‌نمایش اسلاید محتوا",
  });
  await expect(inspector).toBeVisible();
  await expect(preview).toBeVisible();
  await expectAccessible(page, "content editor");

  const imageAction = inspector.getByRole("button", {
    name: "افزودن تصویر",
    exact: true,
  });
  await expect(imageAction).toBeVisible();
  expect(
    await imageAction.evaluate((button) => {
      const buttonRect = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      const contentRect = range.getBoundingClientRect();
      return (
        button.scrollWidth <= button.clientWidth + 1 &&
        contentRect.left >= buttonRect.left - 1 &&
        contentRect.right <= buttonRect.right + 1
      );
    }),
  ).toBe(true);

  const titleInput = inspector.getByRole("textbox", {
    name: "عنوان",
    exact: true,
  });
  const textInput = inspector.getByRole("textbox", {
    name: "متن",
    exact: true,
  });

  await titleInput.fill("عنوان ذخیره‌نشده");
  await textInput.fill("متن ذخیره‌نشده\nبا خط دوم");

  await expect(
    preview.getByText("عنوان ذخیره‌نشده", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText("متن ذخیره‌نشده\nبا خط دوم", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText("تغییرات ذخیره‌نشده", { exact: true }),
  ).toBeVisible();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname.endsWith(
        `/api/v1/presentations/${fixture.presentationId}/slides/${fixture.slideId}`,
      ),
  );
  await inspector.getByRole("button", { name: "ذخیره تغییرات" }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedSlide = await saveResponse.json();
  expect(savedSlide.content.title).toBe("عنوان ذخیره‌نشده");
  expect(savedSlide.content.text).toBe("متن ذخیره‌نشده\nبا خط دوم");
  await expect(
    inspector.getByText("همه تغییرات ذخیره شده است."),
  ).toBeVisible();
  await expect(
    inspector.getByRole("button", { name: "ذخیره تغییرات" }),
  ).toBeDisabled();
  await expect(
    preview.getByText("تغییرات ذخیره‌نشده", { exact: true }),
  ).toBeHidden();

  await titleInput.fill("عنوان موقت برای رد");
  await expect(
    preview.getByText("عنوان موقت برای رد", { exact: true }),
  ).toBeVisible();
  await inspector
    .getByRole("button", { name: "بستن تنظیمات اسلاید محتوا" })
    .click();

  const discardDialog = page.getByRole("alertdialog");
  await expect(discardDialog).toContainText(
    "تغییرات ذخیره‌نشده این اسلاید محتوا از بین می‌رود",
  );
  await discardDialog.getByRole("button", { name: "رد تغییرات" }).click();
  await expect(inspector).toBeHidden();
  await expect(
    preview.getByText("عنوان ذخیره‌نشده", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(inspector).toBeVisible();
  await titleInput.fill("نسخه محلی محتوا که باید حفظ شود");
  await expect(
    preview.getByText("نسخه محلی محتوا که باید حفظ شود", { exact: true }),
  ).toBeVisible();

  await page.evaluate(
    async ({ presentationId, slideId, revision, content }) => {
      const cookieValue = (name) => {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const headers = new Headers({
        "Content-Type": "application/json",
        "If-Match": String(revision),
      });
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);

      const response = await fetch(
        `/api/v1/presentations/${presentationId}/slides/${slideId}`,
        {
          method: "PUT",
          credentials: "include",
          headers,
          body: JSON.stringify({
            position: 0,
            kind: "content",
            content: {
              ...content,
              title: "نسخه جدید سرور برای محتوا",
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`external content mutation failed: ${response.status}`);
      }
    },
    {
      presentationId: fixture.presentationId,
      slideId: fixture.slideId,
      revision: savedSlide.revision,
      content: savedSlide.content,
    },
  );

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.status() === 409 &&
      new URL(response.url()).pathname.endsWith(
        `/api/v1/presentations/${fixture.presentationId}/slides/${fixture.slideId}`,
      ),
  );
  await inspector.getByRole("button", { name: "ذخیره تغییرات" }).click();
  await conflictResponsePromise;

  await expect(
    inspector.getByText(/نسخه جدیدتری از این اسلاید ذخیره شده است/),
  ).toBeVisible();
  await expect(titleInput).toHaveValue("نسخه محلی محتوا که باید حفظ شود");
  await expect(
    preview.getByText("نسخه محلی محتوا که باید حفظ شود", { exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByRole("button", { name: "ذخیره تغییرات" }),
  ).toBeDisabled();

  await inspector.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();
  const conflictDialog = page.getByRole("alertdialog");
  await expect(conflictDialog).toContainText(
    "تغییرات محلی این پنل از بین می‌رود",
  );
  await conflictDialog
    .getByRole("button", { name: "بارگذاری نسخه سرور" })
    .click();

  await expect(inspector).toBeHidden();
  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(inspector).toBeVisible();
  await expect(titleInput).toHaveValue("نسخه جدید سرور برای محتوا");
  await expect(
    preview.getByText("نسخه جدید سرور برای محتوا", { exact: true }),
  ).toBeVisible();

  expect(failures).toEqual([]);
});


test("design editor projects a contrast-safe presentation draft and preserves conflicts", async ({ page }) => {
  test.setTimeout(90000);
  const failures = watchRuntime(page);
  const unique = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  const email = "design-editor-" + unique + "@example.com";

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("مدیر تست طراحی");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const fixture = await page.evaluate(async () => {
    const cookieValue = (name) => {
      const prefix = encodeURIComponent(name) + "=";
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const api = async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("Content-Type", "application/json");
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
      const response = await fetch("/api/v1" + path, {
        method: options.method || "GET",
        credentials: "include",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((options.method || "GET") + " " + path + ": " + response.status + " " + JSON.stringify(body));
      }
      return body;
    };

    const presentation = await api("/presentations", {
      method: "POST",
      body: {
        title: "تست طراحی ارائه",
        settings: {
          background_color: "#ffffff",
          text_color: "#111827",
          background_image_url: "",
        },
      },
    });
    const slide = await api("/presentations/" + presentation.id + "/slides", {
      method: "POST",
      headers: { "If-Match": String(presentation.revision) },
      body: {
        position: 0,
        kind: "content",
        content: {
          title: "پیش‌نمایش طراحی",
          text: "متن نمونه برای طراحی",
          image_url: "",
        },
      },
    });

    return {
      presentationId: presentation.id,
      slideId: slide.id,
    };
  });

  await page.goto("/manager/panel/" + fixture.presentationId);
  const preview = page.getByRole("region", {
    name: "پیش‌نمایش اسلاید محتوا",
  });
  await expect(preview).toBeVisible();

  await page.getByRole("button", { name: "طراحی", exact: true }).click();
  const inspector = page.getByRole("complementary", {
    name: "تنظیمات طراحی ارائه",
  });
  await expect(inspector).toBeVisible();
  await expectAccessible(page, "design editor");

  await inspector.getByRole("button", { name: "انتخاب تصویر" }).click();
  const mediaPicker = page.getByRole("dialog", {
    name: "انتخاب تصویر پس‌زمینه",
  });
  await expect(mediaPicker).toBeVisible();
  await expect(
    mediaPicker.getByText("هنوز تصویری ذخیره نکرده‌اید"),
  ).toBeVisible();
  await expectAccessible(page, "background media picker");

  await mediaPicker
    .getByRole("button", { name: "استفاده از لینک خارجی" })
    .click();
  await expect(mediaPicker).toBeHidden();

  const imageUrlDialog = page.getByRole("dialog", {
    name: "استفاده از لینک تصویر پس‌زمینه",
  });
  await expect(imageUrlDialog).toBeVisible();
  const sameOriginImageUrl = new URL("/bg.jpg", page.url()).href;
  await imageUrlDialog
    .getByRole("textbox", { name: "آدرس تصویر" })
    .fill(sameOriginImageUrl);
  await imageUrlDialog
    .getByRole("button", { name: "بررسی تصویر" })
    .click();
  await expect(
    imageUrlDialog.getByRole("img", {
      name: "پیش‌نمایش تصویر انتخاب‌شده",
    }),
  ).toBeVisible();
  await imageUrlDialog
    .getByRole("button", { name: "استفاده از تصویر" })
    .click();
  await expect(imageUrlDialog).toBeHidden();

  const focalControl = inspector.getByRole("button", {
    name: /تنظیم نقطه تمرکز تصویر پس‌زمینه/,
  });
  await expect(focalControl).toBeVisible();
  await focalControl.focus();
  await focalControl.press("ArrowRight");
  await focalControl.press("ArrowRight");
  await focalControl.press("ArrowRight");
  await focalControl.press("ArrowDown");
  await focalControl.press("ArrowDown");

  await expect.poll(async () =>
    preview.evaluate((element) => element.style.backgroundPosition)
  ).toContain("56% 54%");

  const backgroundInput = inspector.locator("#design-background-custom");
  const textInput = inspector.locator("#design-text-custom");

  await backgroundInput.fill("#312e81");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#312e81");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-fg").trim()
    )
  ).toBe("#ffffff");
  await expect(
    preview.getByText("طراحی ذخیره‌نشده", { exact: true }),
  ).toBeVisible();

  await backgroundInput.fill("#ffffff");
  await textInput.fill("#ffffff");
  await expect(textInput).toHaveValue("#0f172a");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-fg").trim()
    )
  ).toBe("#0f172a");

  await backgroundInput.fill("#312e81");
  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith(
        "/api/v1/presentations/" + fixture.presentationId,
      ),
  );
  await inspector.getByRole("button", { name: "ذخیره طراحی" }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedPresentation = await saveResponse.json();
  expect(savedPresentation.settings.background_color).toBe("#312e81");
  expect(savedPresentation.settings.text_color).toBe("#ffffff");
  expect(savedPresentation.settings.background_image_focal_x).toBeCloseTo(0.56);
  expect(savedPresentation.settings.background_image_focal_y).toBeCloseTo(0.54);
  expect(savedPresentation.settings.background_image_url).toBe(
    sameOriginImageUrl,
  );
  expect(savedPresentation.settings.background_image_asset_id).toBe("");
  await expect(
    inspector.getByText(/طراحی ذخیره شده است/),
  ).toBeVisible();

  await backgroundInput.fill("#f0fdf4");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#f0fdf4");

  await inspector
    .getByRole("button", { name: "بستن تنظیمات طراحی" })
    .click();
  const discardDialog = page.getByRole("alertdialog");
  await expect(discardDialog).toContainText(
    "تغییرات ذخیره‌نشده طراحی از بین می‌رود",
  );
  await discardDialog.getByRole("button", { name: "رد تغییرات" }).click();
  await expect(inspector).toBeHidden();
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#312e81");

  await page.getByRole("button", { name: "طراحی", exact: true }).click();
  await expect(inspector).toBeVisible();
  await backgroundInput.fill("#eff6ff");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#eff6ff");

  await page.evaluate(
    async ({ presentationId, revision }) => {
      const cookieValue = (name) => {
        const prefix = encodeURIComponent(name) + "=";
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const headers = new Headers({
        "Content-Type": "application/json",
        "If-Match": String(revision),
      });
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);

      const response = await fetch(
        "/api/v1/presentations/" + presentationId,
        {
          method: "PATCH",
          credentials: "include",
          headers,
          body: JSON.stringify({
            settings: {
              background_color: "#111111",
              text_color: "#ffffff",
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error("external design mutation failed: " + response.status);
      }
    },
    {
      presentationId: fixture.presentationId,
      revision: savedPresentation.revision,
    },
  );

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.status() === 409 &&
      new URL(response.url()).pathname.endsWith(
        "/api/v1/presentations/" + fixture.presentationId,
      ),
  );
  await inspector.getByRole("button", { name: "ذخیره طراحی" }).click();
  await conflictResponsePromise;

  await expect(
    inspector.getByText(/طراحی ارائه جای دیگری تغییر کرده است/),
  ).toBeVisible();
  await expect(backgroundInput).toHaveValue("#eff6ff");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#eff6ff");
  await expect(
    inspector.getByRole("button", { name: "ذخیره طراحی" }),
  ).toBeDisabled();

  await inspector.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();
  const conflictDialog = page.getByRole("alertdialog");
  await expect(conflictDialog).toContainText(
    "تغییرات محلی از بین می‌رود",
  );
  await conflictDialog
    .getByRole("button", { name: "بارگذاری نسخه سرور" })
    .click();

  await expect(inspector).toBeHidden();
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#111111");

  await page.getByRole("button", { name: "طراحی", exact: true }).click();
  await expect(inspector).toBeVisible();
  await expect(backgroundInput).toHaveValue("#111111");
  await expect(textInput).toHaveValue("#ffffff");

  expect(failures).toEqual([]);
});


test("audio editor validates, saves, discards, and preserves local draft across conflicts", async ({ page }) => {
  test.setTimeout(90000);
  const failures = watchRuntime(page);
  const unique = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  const email = "audio-editor-" + unique + "@example.com";
  const tinyWav = Buffer.from(
    "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
    "base64",
  );

  await page.route("https://audio.example.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: tinyWav,
    });
  });

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("مدیر تست صدای ارائه");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const fixture = await page.evaluate(async () => {
    const cookieValue = (name) => {
      const prefix = encodeURIComponent(name) + "=";
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const headers = new Headers({ "Content-Type": "application/json" });
    const csrf = cookieValue("proslides_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
    const response = await fetch("/api/v1/presentations", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({
        title: "تست صدای ارائه",
        settings: {},
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error("create presentation failed: " + response.status);
    }
    return { presentationId: body.id };
  });

  await page.goto("/manager/panel/" + fixture.presentationId);
  await page.getByRole("button", { name: "صدا", exact: true }).click();

  const inspector = page.getByRole("complementary", {
    name: "تنظیمات صدای ارائه",
  });
  await expect(inspector).toBeVisible();
  await expectAccessible(page, "audio editor");

  const urlInput = inspector.getByRole("textbox", {
    name: "نشانی صدا",
    exact: true,
  });
  const saveButton = inspector.getByRole("button", {
    name: "ذخیره صدا",
  });

  await urlInput.fill("javascript:alert(1)");
  await expect(
    inspector.getByText(/آدرس فایل صوتی باید با http:\/\/ یا https:\/\//),
  ).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await urlInput.fill("https://audio.example.test/saved.wav");
  await expect(saveButton).toBeEnabled();
  await expect(
    inspector.getByText("تغییرات صدای ذخیره‌نشده دارید.", { exact: true }),
  ).toBeVisible();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith(
        "/api/v1/presentations/" + fixture.presentationId,
      ),
  );
  await saveButton.click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedPresentation = await saveResponse.json();
  expect(savedPresentation.settings.music_url).toBe(
    "https://audio.example.test/saved.wav",
  );
  await expect(
    inspector.getByText(/تنظیمات صدا ذخیره شده است/),
  ).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await urlInput.fill("https://audio.example.test/temporary.wav");
  await inspector
    .getByRole("button", { name: "بستن تنظیمات صدای ارائه" })
    .click();
  const discardDialog = page.getByRole("alertdialog");
  await expect(discardDialog).toContainText(
    "تغییرات ذخیره‌نشده صدای ارائه از بین می‌رود",
  );
  await discardDialog.getByRole("button", { name: "رد تغییرات" }).click();
  await expect(inspector).toBeHidden();

  await page.getByRole("button", { name: "صدا", exact: true }).click();
  await expect(inspector).toBeVisible();
  await expect(urlInput).toHaveValue("https://audio.example.test/saved.wav");

  await urlInput.fill("https://audio.example.test/local.wav");

  await page.evaluate(
    async ({ presentationId, revision }) => {
      const cookieValue = (name) => {
        const prefix = encodeURIComponent(name) + "=";
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const headers = new Headers({
        "Content-Type": "application/json",
        "If-Match": String(revision),
      });
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);

      const response = await fetch(
        "/api/v1/presentations/" + presentationId,
        {
          method: "PATCH",
          credentials: "include",
          headers,
          body: JSON.stringify({
            settings: {
              music_url: "https://audio.example.test/server.wav",
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error("external audio mutation failed: " + response.status);
      }
    },
    {
      presentationId: fixture.presentationId,
      revision: savedPresentation.revision,
    },
  );

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.status() === 409 &&
      new URL(response.url()).pathname.endsWith(
        "/api/v1/presentations/" + fixture.presentationId,
      ),
  );
  await saveButton.click();
  await conflictResponsePromise;

  await expect(
    inspector.getByText(/تنظیمات ارائه جای دیگری تغییر کرده است/),
  ).toBeVisible();
  await expect(urlInput).toHaveValue("https://audio.example.test/local.wav");
  await expect(saveButton).toBeDisabled();

  await inspector.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();
  const conflictDialog = page.getByRole("alertdialog");
  await expect(conflictDialog).toContainText(
    "تغییرات صدای محلی از بین می‌رود",
  );
  await conflictDialog
    .getByRole("button", { name: "بارگذاری نسخه سرور" })
    .click();

  await expect(inspector).toBeHidden();
  await page.getByRole("button", { name: "صدا", exact: true }).click();
  await expect(inspector).toBeVisible();
  await expect(urlInput).toHaveValue("https://audio.example.test/server.wav");

  expect(failures).toEqual([]);
});
