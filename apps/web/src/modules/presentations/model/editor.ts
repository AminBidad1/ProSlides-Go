export type QuestionType = "single" | "multiple";
export type SlideType = 1 | 2 | 3;

export interface EditorOption {
  option_id: string;
  text: string;
  is_correct: boolean;
  image_url: string;
  order: number;
}

export interface EditorQuestion {
  question_id: string;
  title: string;
  text: string;
  question_text: string;
  question_type: QuestionType;
  time_limit: number;
  question_time: number;
  min_point: number;
  max_point: number;
  image_url: string;
  question_image: string;
  faster_answers_more_points: boolean;
  partial_scoring: boolean;
  options: EditorOption[];
}

export interface EditorSlide {
  slide_id: string;
  revision: number;
  order: number;
  slide_type: SlideType;
  show_leaderboard_after: boolean;
  question: EditorQuestion | null;
  title?: string;
  content_text?: string;
  content_image_url?: string;
}

export interface EditorPresentation {
	quiz_id: string;
	revision: number;
	access_code: string;
  title: string;
  quiz_name: string;
  background_color: string;
  background_image_url: string;
  text_color: string;
  music_url: string;
  background: { color: string; image: string; text_color: string };
  slides: EditorSlide[];
  created_at: string;
  last_update: string;
}

export type QuestionLike = Omit<Partial<EditorQuestion>, "options"> & {
  options?: Array<Partial<EditorOption> & { option_text?: string }>;
};

export const getQuestionValidationError = (question: QuestionLike | null | undefined): string | null => {
  if (!question || typeof question !== "object") return "پیش از اجرا یک سؤال اضافه کنید.";

  const text = String(question.text ?? question.question_text ?? "").trim();
  if (!text) return "متن سؤال را وارد کنید.";

  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length < 2) return "حداقل دو گزینه اضافه کنید.";
  if (options.length > 100) return "هر سؤال حداکثر ۱۰۰ گزینه می‌تواند داشته باشد.";
  if (options.some((option) => !String(option.text ?? option.option_text ?? "").trim())) {
    return "هر گزینه باید متن داشته باشد.";
  }
  const ids = options.map((option) => String(option.option_id ?? "").trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    return "شناسه گزینه‌ها باید یکتا باشد.";
  }

  const type = question.question_type;
  if (type !== "single" && type !== "multiple") return "نوع معتبری برای سؤال انتخاب کنید.";
  const correctCount = options.filter((option) => option.is_correct === true).length;
  if (correctCount === 0) return "حداقل یک گزینه صحیح انتخاب کنید.";
  if (type === "single" && correctCount !== 1) return "سؤال تک‌گزینه‌ای دقیقاً یک گزینه صحیح نیاز دارد.";
  if (type === "single" && question.partial_scoring === true) return "امتیازدهی جزئی فقط برای سؤال چندگزینه‌ای در دسترس است.";

  const duration = Number(question.question_time ?? question.time_limit);
  if (!Number.isInteger(duration) || duration < 1 || duration > 86400) {
    return "زمان سؤال باید بین ۱ تا ۸۶۴۰۰ ثانیه باشد.";
  }

  const minPoints = Number(question.min_point);
  const maxPoints = Number(question.max_point);
  if (!Number.isInteger(minPoints) || minPoints < 0 || !Number.isInteger(maxPoints) || maxPoints < 1 || minPoints > maxPoints) {
    return "حداقل و حداکثر امتیاز باید عدد صحیح باشند و ۰ ≤ حداقل ≤ حداکثر.";
  }

  return null;
};

export const getPresentationValidationError = (presentation: Pick<EditorPresentation, "slides">): string | null => {
  if (!presentation.slides.length) return "برای اجرا حداقل یک اسلاید اضافه کنید.";
  for (const slide of presentation.slides) {
    if (slide.slide_type === 1) {
      const error = getQuestionValidationError(slide.question);
      if (error) return error;
    }
    if (slide.slide_type === 2 && !String(slide.title || slide.content_text || slide.content_image_url || "").trim()) {
      return "پیش از اجرا به همه اسلایدهای محتوایی مطلب اضافه کنید.";
    }
  }
  return null;
};
