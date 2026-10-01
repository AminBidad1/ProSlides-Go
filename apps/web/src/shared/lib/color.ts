const HEX = /^#[0-9a-f]{6}$/i;

export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && HEX.test(value.trim());

export const normalizeHexColor = (
  value: unknown,
  fallback: string,
): string => {
  const candidate = String(value ?? "").trim();
  return HEX.test(candidate) ? candidate.toLowerCase() : fallback;
};

export const relativeLuminance = (hex: string): number => {
  const safe = normalizeHexColor(hex, "#000000");
  const channels = [1, 3, 5]
    .map((start) => Number.parseInt(safe.slice(start, start + 2), 16) / 255)
    .map((value) =>
      value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    );

  return (
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722
  );
};

export const contrastRatio = (
  first: string,
  second: string,
): number => {
  const [light, dark] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);

  return (light + 0.05) / (dark + 0.05);
};

export const readableForegroundColor = (
  background: string,
  light = "#ffffff",
  dark = "#0f172a",
): string =>
  contrastRatio(background, light) >= contrastRatio(background, dark)
    ? light
    : dark;
