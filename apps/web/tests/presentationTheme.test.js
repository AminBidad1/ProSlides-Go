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
