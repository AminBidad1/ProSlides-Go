import assert from "node:assert/strict";
import test from "node:test";

import {
  isLivePresentationDefinitionReady,
  toLivePresentationModel,
} from "../src/modules/live/routes/useLivePresentationModel.ts";

test("live presentation mapper normalizes unknown settings into domain strings", () => {
  const presentation = {
    id: "presentation-1",
    title: "نمونه",
    access_code: "123456",
    settings: {
      background_color: { legacy: true },
      background_image_url: 42,
      text_color: null,
      music_url: ["unexpected"],
    },
    slides: [],
  };

  assert.deepEqual(toLivePresentationModel(presentation), {
    quiz_id: "presentation-1",
    title: "نمونه",
    access_code: "123456",
    background: {
      color: "#1e1e2e",
      image: "",
      text_color: "#111827",
    },
    music_url: "",
    slides: [],
    text_color: "#111827",
  });
});

test("live presentation mapper preserves validated string settings", () => {
  const presentation = {
    id: "presentation-2",
    title: "نمونه دوم",
    access_code: "",
    settings: {
      background_color: "#312e81",
      background_image_url: "https://example.test/bg.jpg",
      text_color: "#ffffff",
      music_url: "https://example.test/music.mp3",
    },
    slides: [],
  };

  const model = toLivePresentationModel(presentation);

  assert.deepEqual(model.background, {
    color: "#312e81",
    image: "https://example.test/bg.jpg",
    text_color: "#ffffff",
  });
  assert.equal(model.music_url, "https://example.test/music.mp3");
  assert.equal(model.text_color, "#ffffff");
});


test("manager frozen Session items are sufficient when mutable Presentation loading fails", () => {
  const snapshot = {
    role: "manager",
    session: {
      id: "session-1",
      presentation_id: "presentation-1",
      host_id: "manager-1",
      join_code: "ROOM1",
      state: "lobby",
      state_version: 2,
      active_item_id: null,
      activity_phase: null,
      stage_view: "item",
      ends_at: null,
    },
    items: [],
    participant_count: 0,
    has_scoring: false,
    last_event_id: 1,
    activity_top_performers: [],
  };

  assert.equal(
    isLivePresentationDefinitionReady({
      role: "manager",
      remoteQuiz: null,
      snapshot,
    }),
    true,
  );
  assert.equal(
    isLivePresentationDefinitionReady({
      role: "manager",
      remoteQuiz: null,
      snapshot: { ...snapshot, items: undefined },
    }),
    false,
  );
});
