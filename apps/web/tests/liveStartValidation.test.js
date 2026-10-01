import assert from "node:assert/strict";
import test from "node:test";

import {
  findLiveActivityStartIssue,
  getLiveActivityStartIssue,
} from "../src/modules/live/model/presentationFlow.ts";
import { toLivePresentationModel } from "../src/modules/live/routes/useLivePresentationModel.ts";

const optionA = "f335ac87-4586-4254-a2cb-1978b7e5a421";
const optionB = "5bbab239-6d13-4813-8c4a-4f9b39f1852e";

const firstPartyPromptImage =
  "/api/v1/media/assets/123e4567-e89b-42d3-a456-426614174050/content";
const firstPartyContentImage =
  "/api/v1/media/assets/123e4567-e89b-42d3-a456-426614174052/content";

const choice = {
  id: "choice-1",
  revision: 2,
  position: 0,
  kind: "activity",
  content: {
    schema_version: 1,
    activity_kind: "choice",
    prompt: { title: "", text: "سؤال جدید", image_url: "" },
    response: {
      selection: "single",
      options: [
        { id: optionA, text: "گزینه ۱", image_url: "", order: 1 },
        { id: optionB, text: "گزینه ۲", image_url: "", order: 2 },
      ],
    },
    evaluation: {
      mode: "correctness",
      correct_option_ids: [optionA],
    },
    scoring: {
      mode: "points",
      max_points: 100,
      min_points: 0,
      speed_bonus: false,
      partial_credit: false,
    },
    timing: { duration_seconds: 10 },
    results: { show_overall_leaderboard_after: true },
  },
};

const wordCloud = {
  id: "cloud-1",
  revision: 1,
  position: 1,
  kind: "activity",
  content: {
    schema_version: 1,
    activity_kind: "text",
    prompt: {
      title: "",
      text: "این موضوع را با چه واژه‌هایی توصیف می‌کنید؟",
      image_url: "",
    },
    response: { max_words: 3, max_length: 40 },
    evaluation: { mode: "none" },
    scoring: { mode: "none" },
    timing: { duration_seconds: 30 },
    results: {
      aggregation: "word_frequency",
      show_overall_leaderboard_after: false,
    },
  },
};

const poll = {
  id: "poll-1",
  revision: 1,
  position: 2,
  kind: "activity",
  content: {
    schema_version: 1,
    activity_kind: "choice",
    prompt: { title: "", text: "نظرسنجی جدید", image_url: "" },
    response: {
      selection: "single",
      options: [
        { id: "poll-a", text: "گزینه ۱", image_url: "", order: 1 },
        { id: "poll-b", text: "گزینه ۲", image_url: "", order: 2 },
      ],
    },
    evaluation: { mode: "none", correct_option_ids: [] },
    scoring: {
      mode: "none",
      max_points: 0,
      min_points: 0,
      speed_bonus: false,
      partial_credit: false,
    },
    timing: { duration_seconds: 10 },
    results: { show_overall_leaderboard_after: false },
  },
};

test("valid Choice + Word Cloud + Poll presentation can start", () => {
  const model = toLivePresentationModel({
    id: "presentation-1",
    title: "ارائه بدون عنوان",
    access_code: "MMMMM",
    settings: {},
    slides: [
      choice,
      wordCloud,
      {
        id: "content-1",
        revision: 1,
        position: 2,
        kind: "content",
        content: {
          title: "اسلاید محتوایی جدید",
          text: "",
          image_url: "",
        },
      },
      { ...wordCloud, id: "cloud-2", position: 3 },
      { ...poll, position: 4 },
    ],
  });

  assert.equal(model.slides[0].activity_kind, "choice");
  assert.deepEqual(
    model.slides[0].options.map((option) => option.answer),
    [true, false],
  );
  assert.equal(model.slides[1].activity_kind, "text");
  assert.deepEqual(model.slides[1].options, []);
  assert.equal(model.slides[4].has_correct_answer, false);
  assert.equal(findLiveActivityStartIssue(model.slides), null);
});

test("Word Cloud is not rejected for having no Choice options", () => {
  const model = toLivePresentationModel({
    id: "presentation-1",
    title: "ابر واژه",
    access_code: "MMMMM",
    settings: {},
    slides: [wordCloud],
  });

  assert.equal(getLiveActivityStartIssue(model.slides[0]), null);
});

test("Choice validation remains strict while Poll does not require correctness", () => {
  const invalidChoice = {
    item_kind: "activity",
    activity_kind: "choice",
    question_text: "سؤال",
    question_type: "single",
    question_time: 10,
    image_url: "",
    has_correct_answer: true,
    options: [
      { option_id: 0, option_text: "الف", answer: false },
      { option_id: 1, option_text: "ب", answer: false },
    ],
  };
  const validPoll = {
    ...invalidChoice,
    has_correct_answer: false,
  };

  assert.equal(
    getLiveActivityStartIssue(invalidChoice),
    "choice_correct_answer_invalid",
  );
  assert.equal(getLiveActivityStartIssue(validPoll), null);
});

test("legacy Choice activities respect quiz and poll projection caps", () => {
  const quizOptions = Array.from({ length: 9 }, (_, index) => ({
    option_id: index,
    option_text: `گزینه ${index + 1}`,
    answer: index === 0,
  }));
  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "activity",
      activity_kind: "choice",
      question_text: "سؤال شلوغ",
      question_type: "single",
      question_time: 10,
      image_url: "",
      has_correct_answer: true,
      options: quizOptions,
    }),
    "choice_options_too_many",
  );

  const pollOptions = Array.from({ length: 13 }, (_, index) => ({
    option_id: index,
    option_text: `گزینه ${index + 1}`,
    answer: false,
  }));
  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "activity",
      activity_kind: "choice",
      question_text: "نظرسنجی شلوغ",
      question_type: "single",
      question_time: 10,
      image_url: "",
      has_correct_answer: false,
      options: pollOptions,
    }),
    "choice_options_too_many",
  );
});

test("media references never block an already-created live session", () => {
  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "activity",
      activity_kind: "choice",
      question_text: "سؤال تصویری",
      question_type: "single",
      question_time: 10,
      image_url: "javascript:alert(1)",
      has_correct_answer: true,
      options: [
        {
          option_id: "a",
          option_text: "الف",
          image_url: "data:image/png;base64,AAAA",
          answer: true,
        },
        {
          option_id: "b",
          option_text: "ب",
          image_url: "",
          answer: false,
        },
      ],
    }),
    null,
  );

  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "activity",
      activity_kind: "text",
      question_text: "ابر واژه تصویری",
      question_time: 30,
      image_url: firstPartyPromptImage,
      response_aggregation: "word_frequency",
      response_max_length: 40,
      response_max_words: 3,
      options: [],
      has_correct_answer: false,
    }),
    null,
  );

  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "content",
      title: "محتوا",
      content_text: "",
      content_image_url: firstPartyContentImage,
    }),
    null,
  );
});

test("preflight blocks legacy slides that violate current projection policy", () => {
  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "activity",
      activity_kind: "choice",
      question_text: "س".repeat(181),
      question_time: 10,
      image_url: "",
      question_type: "single",
      has_correct_answer: true,
      options: [
        { option_id: "a", option_text: "الف", image_url: "", answer: true },
        { option_id: "b", option_text: "ب", image_url: "", answer: false },
      ],
    }),
    "choice_prompt_invalid",
  );

  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "activity",
      activity_kind: "text",
      question_text: "ابر واژه",
      question_time: 30,
      image_url: "",
      response_aggregation: "word_frequency",
      response_max_length: 80,
      response_max_words: 3,
      options: [],
      has_correct_answer: false,
    }),
    "text_response_invalid",
  );

  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "content",
      title: "محتوا",
      content_text: "خط\n".repeat(11),
      content_image_url: "",
    }),
    "content_density_invalid",
  );
});

test("Text Activity validates its own prompt instead of Choice rules", () => {
  assert.equal(
    getLiveActivityStartIssue({
      item_kind: "activity",
      activity_kind: "text",
      question_text: "   ",
      options: [],
      has_correct_answer: false,
    }),
    "text_prompt_required",
  );
});
