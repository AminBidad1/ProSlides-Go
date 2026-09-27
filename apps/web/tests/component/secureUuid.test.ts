import { describe, expect, test, vi } from "vitest";

import { createSecureUUID } from "../../src/shared/browser/secureUuid.ts";

describe("createSecureUUID", () => {
  test("prefers native randomUUID when available", () => {
    const randomUUID = vi.fn(() => "11111111-2222-4333-8444-555555555555");
    const getRandomValues = vi.fn((array: Uint8Array) => array);

    expect(createSecureUUID({ randomUUID, getRandomValues })).toBe(
      "11111111-2222-4333-8444-555555555555",
    );
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  test("builds a UUID v4 from getRandomValues when randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((array: Uint8Array) => {
      array.set([
        0x00, 0x01, 0x02, 0x03,
        0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0a, 0x0b,
        0x0c, 0x0d, 0x0e, 0x0f,
      ]);
      return array;
    });

    expect(createSecureUUID({ getRandomValues })).toBe(
      "00010203-0405-4607-8809-0a0b0c0d0e0f",
    );
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  test("fails explicitly when secure randomness is unavailable", () => {
    expect(() => createSecureUUID({})).toThrow(
      "Secure random UUID generation is unavailable",
    );
  });
});
