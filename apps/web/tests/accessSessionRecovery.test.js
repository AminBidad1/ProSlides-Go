import assert from "node:assert/strict";
import test from "node:test";

import {
  clearAccessSessionRecovery,
  readAccessSessionRecovery,
  saveAccessSessionRecovery,
} from "../src/modules/live/model/accessSessionRecovery.ts";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

const locator = {
  session_id: "11111111-1111-4111-8111-111111111111",
  presentation_id: "22222222-2222-4222-8222-222222222222",
  presentation: {
    title: "نمونه",
    background_color: "#123456",
    background_image_url: "",
    music_url: "",
    text_color: "#ffffff",
  },
};

test("access-code recovery is case-insensitive and scoped to its cached Session", () => {
  const storage = createStorage();
  const now = Date.parse("2026-09-27T12:00:00Z");

  saveAccessSessionRecovery("room1", locator, storage, now);

  assert.deepEqual(
    readAccessSessionRecovery("ROOM1", storage, now + 60_000),
    locator,
  );
  assert.equal(readAccessSessionRecovery("OTHER", storage, now + 60_000), null);

  clearAccessSessionRecovery("RoOm1", storage);
  assert.equal(readAccessSessionRecovery("ROOM1", storage, now + 60_000), null);
});

test("access-code recovery expires stale session targets", () => {
  const storage = createStorage();
  const now = Date.parse("2026-09-27T12:00:00Z");

  saveAccessSessionRecovery("ROOM1", locator, storage, now);

  assert.equal(
    readAccessSessionRecovery(
      "ROOM1",
      storage,
      now + 24 * 60 * 60 * 1000 + 1,
    ),
    null,
  );
});
