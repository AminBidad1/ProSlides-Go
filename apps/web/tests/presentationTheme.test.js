import assert from "node:assert/strict";
import test from "node:test";

import {
  PRESENTATION_THEME_PRESETS,
  normalizeVisualizationPalette,
  presentationTheme,
  presentationVisualizationColor,
} from "../src/shared/styles/presentationTheme.ts";

test("presentation theme corrects unreadable text colors", () => {
  const theme = presentationTheme({
    background: { color: "#ffffff" },
    text_color: "#ffffff",
  });

  assert.equal(theme.foreground, "#0f172a");
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

test("invalid or undersized palettes fall back to the product palette", () => {
  assert.equal(
    normalizeVisualizationPalette(["#112233", "#445566"]).length,
    6,
  );
  assert.ok(PRESENTATION_THEME_PRESETS.length >= 4);
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
