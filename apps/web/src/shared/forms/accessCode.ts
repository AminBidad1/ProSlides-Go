import { normalizeDigits } from "./numbers.ts";

export const ACCESS_CODE_MIN_LENGTH = 5;
export const ACCESS_CODE_MAX_LENGTH = 12;

export const normalizeAccessCode = (value: string): string =>
  normalizeDigits(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, ACCESS_CODE_MAX_LENGTH);

export const isValidAccessCode = (value: string): boolean =>
  new RegExp(
    `^[A-Z0-9]{${ACCESS_CODE_MIN_LENGTH},${ACCESS_CODE_MAX_LENGTH}}$`,
  ).test(value);
