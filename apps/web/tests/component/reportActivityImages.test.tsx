import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type {
  ReportActivityPage,
  ReportActivitySummary,
} from "../../src/modules/reports/api/reportApi.ts";
import { ActivityReportPanel } from "../../src/modules/reports/ui/ActivityReportPanel.tsx";

describe("ActivityReportPanel image context", () => {
  test("renders frozen prompt and option images with responsive first-party delivery", () => {
    const promptAsset = "123e4567-e89b-42d3-a456-426614174050";
    const optionAsset = "123e4567-e89b-42d3-a456-426614174051";
    const activity = {
      activity_item_id: "123e4567-e89b-42d3-a456-426614174060",
      position: 0,
      response_count: 2,
      scored: false,
      definition: {
        schema_version: 1,
        activity_kind: "choice",
        prompt: {
          title: "تشخیص نمودار",
          text: "کدام گزینه درست است؟",
          image_url: `/api/v1/media/assets/${promptAsset}/content`,
          image_asset_id: promptAsset,
          image_width: 1920,
          image_height: 1080,
          image_alt_text: "نمودار سؤال",
        },
        response: {
          selection: "single",
          options: [
            {
              id: "a",
              text: "گزینه الف",
              order: 1,
              image_url: `/api/v1/media/assets/${optionAsset}/content`,
              image_asset_id: optionAsset,
              image_width: 640,
              image_height: 360,
              image_alt_text: "تصویر گزینه",
            },
            { id: "b", text: "گزینه ب", order: 2, image_url: "" },
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
    } as ReportActivitySummary;

    const page = {
      activity,
      result: {
        activity_item_id: activity.activity_item_id,
        activity_kind: "choice",
        schema_version: 1,
        response_count: 2,
        payload: { option_counts: { a: 2, b: 0 } },
      },
      top_performers: [],
      responses: [],
      limit: 50,
      has_more: false,
    } as ReportActivityPage;

    render(
      <ActivityReportPanel
        activity={activity}
        pages={[page]}
        isLoading={false}
        isError={false}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    expect(
      screen.getByRole("img", { name: "نمودار سؤال" }).getAttribute("src"),
    ).toBe(`/api/v1/media/assets/${promptAsset}/renditions/medium`);
    expect(
      screen.getByRole("img", { name: "تصویر گزینه" }).getAttribute("src"),
    ).toBe(`/api/v1/media/assets/${optionAsset}/renditions/thumbnail`);
  });
});
