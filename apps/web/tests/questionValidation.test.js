import test from "node:test";
import assert from "node:assert/strict";

import {
  getContentValidationError,
  getQuestionValidationError,
} from "../src/modules/presentations/model/editor.ts";
import {
  getPresentationValidationError,
} from "../src/modules/presentations/model/itemRegistry.ts";

const validQuestion = {
  question_text: "Choose",
  question_type: "multiple",
  question_time: 30,
  min_point: 0,
  max_point: 100,
  options: [
    { option_id: "a", text: "A", is_correct: true },
    { option_id: "b", text: "B", is_correct: false },
  ],
};

test("accepts a complete question", () => {
  assert.equal(getQuestionValidationError(validQuestion), null);
});

test("rejects invalid scoring and timing ranges", () => {
  assert.match(getQuestionValidationError({ ...validQuestion, question_time: 4 }), /زمان/i);
  assert.match(getQuestionValidationError({ ...validQuestion, question_time: 1201 }), /زمان/i);
  assert.match(getQuestionValidationError({ ...validQuestion, min_point: 101 }), /امتیاز/i);
  assert.match(getQuestionValidationError({ ...validQuestion, max_point: 0 }), /امتیاز/i);
});

test("rejects incomplete and inconsistent options", () => {
  assert.match(getQuestionValidationError({ ...validQuestion, options: [{ text: "A", is_correct: true }] }), /دو گزینه/i);
  assert.match(getQuestionValidationError({ ...validQuestion, question_type: "single", options: validQuestion.options.map((option) => ({ ...option, is_correct: true })) }), /یک گزینه صحیح/i);
});

test("uses separate projector-safe option limits for quizzes and polls", () => {
  const quizOptions = Array.from({ length: 9 }, (_, index) => ({
    option_id: `quiz-option-${index + 1}`,
    text: `Quiz option ${index + 1}`,
    is_correct: index === 0,
  }));
  assert.match(
    getQuestionValidationError({ ...validQuestion, options: quizOptions }),
    /حداکثر ۸ گزینه/,
  );

  const pollOptions = Array.from({ length: 13 }, (_, index) => ({
    option_id: `poll-option-${index + 1}`,
    text: `Poll option ${index + 1}`,
    is_correct: false,
  }));
  assert.match(
    getQuestionValidationError({
      ...validQuestion,
      evaluation_mode: "none",
      scoring_mode: "none",
      min_point: 0,
      max_point: 0,
      options: pollOptions,
    }),
    /حداکثر ۱۲ گزینه/,
  );
});

test("rejects non-http media URLs before save or live start", () => {
  assert.match(
    getQuestionValidationError({
      ...validQuestion,
      image_url: "javascript:alert(1)",
    }),
    /http/i,
  );
  assert.match(
    getQuestionValidationError({
      ...validQuestion,
      options: validQuestion.options.map((option, index) => ({
        ...option,
        image_url: index === 0 ? "data:image/png;base64,AAAA" : "",
      })),
    }),
    /http/i,
  );
  assert.match(
    getContentValidationError({
      title: "Intro",
      content_image_url: "ftp://example.com/image.png",
    }),
    /http/i,
  );
});

test("rejects duplicate option identities and single-choice partial scoring", () => {
  assert.match(getQuestionValidationError({
    ...validQuestion,
    options: validQuestion.options.map((option) => ({ ...option, option_id: "same" })),
  }), /یکت/i);
  assert.match(getQuestionValidationError({
    ...validQuestion,
    question_type: "single",
    partial_scoring: true,
  }), /جزئی/i);
});

test("rejects projection-hostile explicit line counts", () => {
  assert.match(
    getQuestionValidationError({
      ...validQuestion,
      question_text: "۱\n۲\n۳\n۴\n۵",
    }),
    /۴ خط/,
  );
  assert.match(
    getQuestionValidationError({
      ...validQuestion,
      options: [
        {
          ...validQuestion.options[0],
          text: "۱\n۲\n۳\n۴\n۵",
        },
        validQuestion.options[1],
      ],
    }),
    /۴ خط/,
  );
  assert.match(
    getContentValidationError({
      title: "Intro",
      content_text: Array.from({ length: 11 }, (_, index) => String(index + 1)).join("\n"),
    }),
    /۱۰ خط/,
  );
});

test("presentation validation is shared by editor and dashboard present actions", () => {
  assert.match(getPresentationValidationError({ slides: [] }), /حداقل یک اسلاید/i);
  const choice = {
    item_kind: "activity",
    activity_kind: "choice",
    schema_version: 1,
    show_leaderboard_after: false,
    question: validQuestion,
  };
  assert.equal(getPresentationValidationError({ slides: [choice] }), null);
  assert.match(getPresentationValidationError({
    slides: [{ ...choice, question: { ...validQuestion, question_time: 0 } }],
  }), /زمان/i);
  assert.match(getPresentationValidationError({
    slides: [{
      item_kind: "content",
      title: "",
      content_text: "",
      content_image_url: "",
    }],
  }), /عنوان، متن یا تصویر/i);
  assert.equal(getPresentationValidationError({
    slides: [{
      item_kind: "content",
      title: "Introduction",
      content_text: "",
      content_image_url: "",
    }],
  }), null);
});


test("content validation shares the editor contract and unicode limits", () => {
  assert.match(
    getContentValidationError({ title: "", content_text: "", content_image_url: "" }),
    /عنوان، متن یا تصویر/i,
  );
  assert.equal(
    getContentValidationError({ title: "ع".repeat(120), content_text: "م".repeat(600) }),
    null,
  );
  assert.match(
    getContentValidationError({ title: "ع".repeat(121) }),
    /عنوان/i,
  );
  assert.match(
    getContentValidationError({ content_text: "م".repeat(601) }),
    /متن/i,
  );
});
