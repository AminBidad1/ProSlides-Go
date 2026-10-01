import { describe, expect, test } from "vitest";

import {
  layoutWordCloudTerms,
  type WordCloudDisplayMode,
} from "../../src/shared/ui/wordCloudLayout.ts";

const sampleTerms = [
  { text: "خلاقیت", count: 40 },
  { text: "سادگی", count: 22 },
  { text: "تعامل", count: 15 },
  { text: "یادگیری", count: 9 },
  { text: "هوش مصنوعی", count: 6 },
  { text: "بازخورد", count: 3 },
] as const;

const byText = (
  mode: WordCloudDisplayMode,
  terms: readonly { text: string; count: number }[] = sampleTerms,
) =>
  new Map(
    layoutWordCloudTerms(terms, mode).map((term) => [term.text, term]),
  );

describe("WordCloudRenderer layout", () => {
  test("encodes frequency primarily through font size", () => {
    const positioned = layoutWordCloudTerms(sampleTerms, "projection");
    const layout = new Map(positioned.map((term) => [term.text, term]));
    const visibleFontSizes = positioned.map((term) => term.fontSize);

    expect(positioned.length).toBeGreaterThan(1);
    expect(layout.get("خلاقیت")?.fontSize).toBe(Math.max(...visibleFontSizes));
    expect(Math.min(...visibleFontSizes)).toBeGreaterThanOrEqual(32);
    expect(Math.max(...visibleFontSizes)).toBeGreaterThan(
      Math.min(...visibleFontSizes),
    );
  });

  test("keeps projection layout deterministic regardless of input order", () => {
    const first = byText("projection");
    const second = byText("projection", [...sampleTerms].reverse());

    for (const [text, term] of first) {
      expect(second.get(text)).toEqual(term);
    }
  });

  test("assigns deterministic decorative term colors", () => {
    const layout = byText("projection");
    const colors = new Set([...layout.values()].map((term) => term.color));

    expect(colors.size).toBeGreaterThan(1);
    expect(layout.get("خلاقیت")?.color).toMatch(
      /^var\(--live-palette-text-[1-8], /,
    );
    expect(layout.get("خلاقیت")?.color).toContain("currentColor 60%");
  });

  test("reduces equal-frequency type size as the cloud gets dense", () => {
    const denseEqualTerms = Array.from({ length: 72 }, (_, index) => ({
      text: `عبارت ${index + 1}`,
      count: 1,
    }));
    const dense = layoutWordCloudTerms(denseEqualTerms, "projection");

    expect(dense.length).toBeGreaterThan(0);
    expect(dense[0]?.fontSize).toBeLessThanOrEqual(44);
    expect(dense[0]?.fontSize).toBeGreaterThanOrEqual(32);
  });

  test("applies a stricter term budget to projector output", () => {
    const manyTerms = Array.from({ length: 120 }, (_, index) => ({
      text: `عبارت ${index + 1}`,
      count: 120 - index,
    }));

    expect(layoutWordCloudTerms(manyTerms, "projection").length).toBeLessThanOrEqual(
      72,
    );
    expect(layoutWordCloudTerms(manyTerms, "embedded").length).toBeLessThanOrEqual(
      100,
    );
  });
});
