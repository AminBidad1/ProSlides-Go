import assert from "node:assert/strict";
import test from "node:test";

import {
  activityImage,
  choiceOptionImage,
  choiceOptions,
  isPollActivity,
  isWordCloudActivity,
  responseLabels,
  wordCloudTerms,
} from "../src/modules/reports/model/reportView.ts";

const pollActivity = {
  activity_item_id: "poll-1",
  position: 0,
  response_count: 2,
  scored: false,
  definition: {
    schema_version: 1,
    activity_kind: "choice",
    prompt: {
      title: "اولویت بعدی",
      text: "کدام موضوع مهم‌تر است؟",
      image_url: "/api/v1/media/assets/123e4567-e89b-42d3-a456-426614174050/content",
      image_asset_id: "123e4567-e89b-42d3-a456-426614174050",
      image_width: 1600,
      image_height: 900,
      image_alt_text: "نمودار اولویت‌ها",
      image_focal_x: 0.25,
      image_focal_y: 0.75,
    },
    response: {
      selection: "single",
      options: [
        {
          id: "b",
          text: "تست",
          order: 2,
          image_url: "/api/v1/media/assets/123e4567-e89b-42d3-a456-426614174051/content",
          image_asset_id: "123e4567-e89b-42d3-a456-426614174051",
          image_width: 640,
          image_height: 360,
          image_alt_text: "تصویر گزینه تست",
        },
        { id: "a", text: "معماری", order: 1 },
      ],
    },
    evaluation: { mode: "none", correct_option_ids: [] },
    scoring: {
      mode: "none",
      min_points: 0,
      max_points: 0,
      speed_bonus: false,
      partial_credit: false,
    },
    timing: { duration_seconds: 30 },
    results: { show_overall_leaderboard_after: false },
  },
};

test("reports derive Poll from frozen Choice policies instead of a new Activity kind", () => {
  assert.equal(isPollActivity(pollActivity), true);
  assert.deepEqual(
    choiceOptions(pollActivity).map((option) => option.id),
    ["a", "b"],
  );
});

test("reports preserve frozen prompt and option image placement metadata", () => {
  const promptImage = activityImage(pollActivity);
  assert.equal(promptImage?.assetId, "123e4567-e89b-42d3-a456-426614174050");
  assert.equal(promptImage?.altText, "نمودار اولویت‌ها");
  assert.equal(promptImage?.focalX, 0.25);
  assert.equal(promptImage?.focalY, 0.75);

  const option = choiceOptions(pollActivity).find((item) => item.id === "b");
  assert.ok(option);
  const optionImage = choiceOptionImage(option);
  assert.equal(optionImage?.assetId, "123e4567-e89b-42d3-a456-426614174051");
  assert.equal(optionImage?.altText, "تصویر گزینه تست");
});

test("Poll response labels use frozen response positions before display ordering", () => {
  const response = {
    response: { selected_option_indexes: [0] },
  };

  assert.deepEqual(responseLabels(pollActivity, response), ["تست"]);
});


const wordCloudActivity = {
  activity_item_id: "cloud-1",
  position: 1,
  response_count: 3,
  scored: false,
  definition: {
    schema_version: 1,
    activity_kind: "text",
    prompt: { title: "نظر جمع", text: "سه واژه بنویسید", image_url: "" },
    response: { max_length: 80, max_words: 3 },
    evaluation: { mode: "none" },
    scoring: { mode: "none" },
    timing: { duration_seconds: 30 },
    results: {
      aggregation: "word_frequency",
      show_overall_leaderboard_after: false,
    },
  },
};

test("reports derive Word Cloud from the frozen Text aggregation policy", () => {
  assert.equal(isWordCloudActivity(wordCloudActivity), true);
  assert.equal(isPollActivity(wordCloudActivity), false);
  assert.deepEqual(choiceOptions(wordCloudActivity), []);
});


test("entry Word Cloud reports preserve authored phrases", () => {
  const entryActivity = {
    ...wordCloudActivity,
    definition: {
      ...wordCloudActivity.definition,
      response: { max_entry_length: 30, max_entries: 3 },
      results: {
        aggregation: "entry_frequency",
        show_overall_leaderboard_after: false,
      },
    },
  };

  assert.equal(isWordCloudActivity(entryActivity), true);
  assert.deepEqual(
    responseLabels(entryActivity, {
      response: {
        entries: ["هوش مصنوعی", "کار تیمی"],
        terms: ["هوش مصنوعی", "کار تیمی"],
      },
    }),
    ["هوش مصنوعی", "کار تیمی"],
  );
});

test("Word Cloud responses and result terms preserve frozen text", () => {
  assert.deepEqual(
    responseLabels(wordCloudActivity, {
      response: {
        text: "داده و هوش",
        terms: ["داده", "و", "هوش"],
      },
    }),
    ["داده و هوش"],
  );

  assert.deepEqual(
    wordCloudTerms({
      activity: wordCloudActivity,
      result: {
        activity_item_id: "cloud-1",
        activity_kind: "text",
        schema_version: 1,
        response_count: 3,
        payload: {
          terms: [
            { text: "داده", count: 3 },
            { text: "هوش", count: 2 },
          ],
        },
      },
      top_performers: [],
      responses: [],
      limit: 50,
      has_more: false,
    }),
    [
      { text: "داده", count: 3 },
      { text: "هوش", count: 2 },
    ],
  );
});
