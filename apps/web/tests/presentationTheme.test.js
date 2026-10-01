import assert from "node:assert/strict";
import test from "node:test";

import {
  PRESENTATION_THEME_PRESETS,
  normalizeVisualizationPalette,
  presentationContrastRatio,
  presentationTheme,
  presentationVisualizationColor,
} from "../src/shared/styles/presentationTheme.ts";

const wordCloudBackground = (theme) =>
  String(theme.style["--live-word-cloud-bg"]);
const wordCloudTextColors = (theme, count) =>
  Array.from({ length: count }, (_, index) =>
    String(theme.style[`--live-palette-text-${index + 1}`]),
  );

test("presentation theme corrects unreadable text colors", () => {
  const theme = presentationTheme({
    background: { color: "#ffffff" },
    text_color: "#ffffff",
  });

  assert.equal(theme.foreground, "#0f172a");
  assert.ok(theme.contrastRatio >= 4.5);
});

test("presentation theme keeps the AA floor on mid-tone custom backgrounds", () => {
  const theme = presentationTheme({
    background: { color: "#7a7a7a" },
    text_color: "#777777",
  });

  assert.ok(theme.contrastRatio >= 4.5);
});

test("presentation theme uses foreground-aware image overlays", () => {
  const dark = presentationTheme({
    background: { color: "#111827", image: "https://example.com/bg.jpg" },
    text_color: "#ffffff",
  });
  const light = presentationTheme({
    background: { color: "#ffffff", image: "https://example.com/bg.jpg" },
    text_color: "#0f172a",
  });

  assert.match(String(dark.style.backgroundImage), /rgba\(0,0,0,.46\)/);
  assert.match(String(light.style.backgroundImage), /rgba\(255,255,255,.62\)/);
});

test("background focal point controls only the covered image layer", () => {
  const theme = presentationTheme({
    background: {
      color: "#111827",
      image: "https://example.com/bg.jpg",
      focal_x: 0.23,
      focal_y: 0.81,
    },
    text_color: "#ffffff",
  });

  assert.equal(theme.focalX, 0.23);
  assert.equal(theme.focalY, 0.81);
  assert.equal(theme.style.backgroundPosition, "center, 23% 81%");
  assert.equal(theme.style.backgroundSize, "cover, cover");
});

test("background focal point defaults to center and clamps unsafe runtime values", () => {
  const centered = presentationTheme({
    background: {
      image: "https://example.com/bg.jpg",
    },
  });
  assert.equal(centered.style.backgroundPosition, "center, 50% 50%");

  const clamped = presentationTheme({
    background: {
      image: "https://example.com/bg.jpg",
      focal_x: 3,
      focal_y: -2,
    },
  });
  assert.equal(clamped.style.backgroundPosition, "center, 100% 0%");
});

test("visualization palettes are bounded and cycle through CSS theme slots", () => {
  const palette = ["#112233", "#445566", "#778899"];
  const theme = presentationTheme({
    visualization_palette: palette,
  });

  assert.equal(theme.palette.length, 3);
  assert.equal(theme.style["--live-palette-1"], palette[0]);
  assert.equal(theme.style["--live-palette-4"], palette[0]);
  assert.equal(theme.style["--live-palette-8"], palette[1]);
  assert.match(presentationVisualizationColor("answer-1"), /^var\(--live-palette-[1-8], /);
});

test("visualization text palette preserves safe accents and minimally corrects low contrast", () => {
  const theme = presentationTheme({
    background: { color: "#f8fafc" },
    text_color: "#0f172a",
    visualization_palette: ["#4f46e5", "#0891b2", "#059669"],
  });

  const colors = wordCloudTextColors(theme, 3);
  assert.equal(colors[0], "#4f46e5");
  assert.notEqual(colors[1], "#0891b2");
  assert.notEqual(colors[2], "#059669");
  for (const color of colors) {
    assert.ok(
      presentationContrastRatio(wordCloudBackground(theme), color) >= 4.5,
    );
  }
  assert.equal(theme.style["--live-palette-text-1"], colors[0]);
  assert.equal(theme.style["--live-palette-text-8"], colors[1]);
});

test("word cloud text stays on an opaque theme surface when a background image is present", () => {
  const theme = presentationTheme({
    background: {
      color: "#312e81",
      image: "https://example.com/bright-stage.jpg",
    },
    text_color: "#ffffff",
    visualization_palette: ["#a78bfa", "#22d3ee", "#34d399"],
  });

  const background = wordCloudBackground(theme);
  assert.match(background, /^#[0-9a-f]{6}$/);
  for (const color of wordCloudTextColors(theme, 3)) {
    assert.ok(
      presentationContrastRatio(background, color) >= 4.5,
    );
  }
});

test("all curated themes derive AA visualization text colors", () => {
  for (const preset of PRESENTATION_THEME_PRESETS) {
    const theme = presentationTheme({
      background: { color: preset.background },
      text_color: preset.foreground,
      accent_color: preset.accent,
      visualization_palette: preset.palette,
    });

    const background = wordCloudBackground(theme);
    for (const color of wordCloudTextColors(theme, preset.palette.length)) {
      assert.ok(
        presentationContrastRatio(background, color) >= 4.5,
        `${preset.id} produced low-contrast visualization text ${color}`,
      );
    }
  }
});

test("custom themes keep every derived Word Cloud term color above the AA floor", () => {
  const backgrounds = [
    "#ffffff",
    "#f8fafc",
    "#7a7a7a",
    "#312e81",
    "#111827",
    "#000000",
  ];
  const palettes = [
    ["#000000", "#777777", "#ffffff"],
    ["#ff0000", "#00ff00", "#0000ff"],
    ["#8b5cf6", "#06b6d4", "#f59e0b"],
  ];

  for (const background of backgrounds) {
    for (const palette of palettes) {
      const theme = presentationTheme({
        background: { color: background },
        text_color: "#777777",
        visualization_palette: palette,
      });

      const surface = wordCloudBackground(theme);
      for (const color of wordCloudTextColors(theme, palette.length)) {
        assert.ok(
          presentationContrastRatio(surface, color) >= 4.5,
          `${background} / ${color} fell below the Word Cloud contrast floor`,
        );
      }
    }
  }
});

test("invalid or undersized palettes fall back to the product palette", () => {
  assert.equal(
    normalizeVisualizationPalette(["#112233", "#445566"]).length,
    6,
  );
  assert.ok(PRESENTATION_THEME_PRESETS.length >= 4);
});


test("first-party backgrounds use bounded delivery by surface", () => {
  const assetId = "123e4567-e89b-42d3-a456-426614174050";
  const master = `/api/v1/media/assets/${assetId}/content`;
  const stage = presentationTheme(
    { background: { color: "#111827", image: master } },
    { surface: "stage" },
  );
  const editor = presentationTheme(
    { background: { color: "#111827", image: master } },
    { surface: "editor" },
  );

  assert.match(
    String(stage.style.backgroundImage),
    new RegExp(`/api/v1/media/assets/${assetId}/renditions/large`),
  );
  assert.match(
    String(editor.style.backgroundImage),
    new RegExp(`/api/v1/media/assets/${assetId}/renditions/medium`),
  );
});

test("participant theme keeps brand styling without loading the background image", () => {
  const theme = presentationTheme(
    {
      background: {
        color: "#083344",
        image: "https://example.com/large-background.jpg",
      },
      text_color: "#f8fafc",
      accent_color: "#22d3ee",
    },
    { surface: "participant" },
  );

  assert.equal(theme.hasBackgroundImage, true);
  assert.equal(theme.showsBackgroundImage, false);
  assert.doesNotMatch(
    String(theme.style.backgroundImage),
    /large-background\.jpg/,
  );
  assert.match(String(theme.style.backgroundImage), /radial-gradient/);
});

test("manager theme retains the image with stronger readability protection", () => {
  const stage = presentationTheme(
    {
      background: {
        color: "#111827",
        image: "https://example.com/bg.jpg",
      },
      text_color: "#ffffff",
    },
    { surface: "stage" },
  );
  const manager = presentationTheme(
    {
      background: {
        color: "#111827",
        image: "https://example.com/bg.jpg",
      },
      text_color: "#ffffff",
    },
    { surface: "manager" },
  );

  assert.equal(manager.showsBackgroundImage, true);
  assert.match(String(stage.style.backgroundImage), /rgba\(0,0,0,.46\)/);
  assert.match(String(manager.style.backgroundImage), /rgba\(0,0,0,.58\)/);
});
