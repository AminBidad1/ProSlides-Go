import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  X,
} from "lucide-react";

import { ApiError } from "../../../../shared/api/http.ts";
import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import {
  emptyImagePlacement,
  IMAGE_ALT_TEXT_MAX_LENGTH,
  imagePlacementFromAsset,
  imagePlacementFromExternalUrl,
  type ImagePlacement,
} from "../../../../shared/media/image.ts";
import { ImagePlacementImage } from "../../../../shared/media/ImagePlacementImage.tsx";
import Notice from "../../../../shared/ui/Notice.tsx";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { Input } from "../../../../shared/ui/primitives/Input.tsx";
import { Textarea } from "../../../../shared/ui/primitives/Textarea.tsx";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import {
  QUESTION_LIMITS,
  type EditorSlide,
  type QuestionValidationIssue,
} from "../../model/editor.ts";
import {
  questionDraftToEditorSlide,
  validateQuestionDraft,
} from "../model/questionDraft.ts";
import { useRequiredQuestionDraft } from "../model/useQuestionDraftContext.ts";
import LazyImagePickerDialog from "./LazyImagePickerDialog.tsx";
import ImageUrlDialog from "./ImageUrlDialog.tsx";
import QuestionOptionsEditor from "./QuestionOptionsEditor.tsx";

type NoticeTone = "info" | "success" | "warning" | "error";

type QuestionInspectorProps = {
  quizId: string;
  slide: EditorSlide;
  onClose: (forceClose?: boolean) => void;
  onSlideUpdated: (slide: EditorSlide) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onNotify?: (message: string, tone?: NoticeTone) => void;
  onConflict?: () => void | Promise<void>;
};

type ConfirmState =
  | { kind: "closed" }
  | { kind: "discard" }
  | { kind: "reload-conflict" };

type ImageTarget =
  | { kind: "question" }
  | { kind: "option"; optionId: string }
  | null;

const issueFor = (
  issues: QuestionValidationIssue[],
  field: QuestionValidationIssue["field"],
): string | null => issues.find((issue) => issue.field === field)?.message ?? null;

const focusIssue = (issue: QuestionValidationIssue | undefined) => {
  if (!issue || typeof document === "undefined") return;

  const target =
    issue.field === "question_text"
      ? "question-editor-text"
      : issue.field === "question_time"
        ? "question-editor-time"
        : issue.field === "points"
          ? "question-editor-max-points"
          : issue.field === "option_text" && issue.optionId
            ? `question-option-${issue.optionId}`
            : issue.field === "options"
              ? "question-options-heading"
              : null;

  if (!target) return;
  const element = document.getElementById(target);
  if (element instanceof HTMLElement) {
    element.focus();
    element.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
};

function QuestionInspectorInner({
  quizId,
  slide,
  onClose,
  onSlideUpdated,
  onDirtyChange,
  onNotify,
  onConflict,
}: QuestionInspectorProps) {
  const {
    draft,
    dirty,
    reset,
    markSaved,
    setQuestionText,
    setQuestionImage,
    setTimeInput,
    setMinPointsInput,
    setMaxPointsInput,
    setFasterPoints,
    setPartialScoring,
    setLeaderboard,
    addOption,
    deleteOption,
    setOptionText,
    setOptionImage,
    toggleCorrect,
    moveOption,
  } = useRequiredQuestionDraft();

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [conflictPending, setConflictPending] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    kind: "closed",
  });
  const [imageTarget, setImageTarget] = useState<ImageTarget>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  const validationIssues = useMemo(
    () => validateQuestionDraft(draft),
    [draft],
  );
  const visibleIssues = showValidation ? validationIssues : [];

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!draft.text.trim() && !isSaving) {
      questionInputRef.current?.focus();
    }
  }, [draft.slideId, draft.text, isSaving]);

  useEffect(() => {
    setLastSavedAt(null);
  }, [slide.slide_id]);

  useEffect(() => {
    setConflictPending(false);
    setShowValidation(false);
  }, [slide.slide_id, slide.revision]);

  const notify = (message: string, tone: NoticeTone = "error") => {
    onNotify?.(message, tone);
  };

  const handleSave = async () => {
    if (!dirty || isSaving || conflictPending) return;

    const issues = validateQuestionDraft(draft);
    if (issues.length) {
      setShowValidation(true);
      notify(issues[0].message, "error");
      window.setTimeout(() => focusIssue(issues[0]), 0);
      return;
    }

    setIsSaving(true);
    try {
      const savedSlide = await quizService.updateSlide(
        quizId,
        slide.slide_id,
        questionDraftToEditorSlide(draft),
      );

      markSaved(savedSlide);
      onSlideUpdated(savedSlide);
      onDirtyChange?.(false);
      setLastSavedAt(new Date());
      setShowValidation(false);
      notify(
        isPoll ? "تغییرات نظرسنجی ذخیره شد." : "تغییرات سؤال ذخیره شد.",
        "success",
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "edit_conflict") {
        setConflictPending(true);
        notify(
          isPoll
            ? "نسخه جدیدتری از این نظرسنجی روی سرور وجود دارد. تغییرات محلی شما هنوز در این پنل نگه داشته شده است."
            : "نسخه جدیدتری از این سؤال روی سرور وجود دارد. تغییرات محلی شما هنوز در این پنل نگه داشته شده است.",
          "warning",
        );
      } else if (
        error instanceof ApiError &&
        error.code === "slide_has_results"
      ) {
        notify(
          "این سؤال پاسخ زنده ثبت‌شده دارد. پیش از تغییر محتوای سؤال، نتایج ارائه را بازنشانی کنید.",
          "warning",
        );
      } else if (error instanceof TypeError) {
        notify(
          "ارتباط با سرور برقرار نشد. تغییرات شما حفظ شده است؛ اتصال را بررسی و دوباره ذخیره کنید.",
          "error",
        );
      } else {
        notify("ذخیره تغییرات انجام نشد. تغییرات شما حفظ شده است.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const discardAndClose = () => {
    reset();
    onDirtyChange?.(false);
    setConfirmState({ kind: "closed" });
    onClose(true);
  };

  const handleClose = () => {
    if (isSaving) return;
    if (dirty) {
      setConfirmState({ kind: "discard" });
      return;
    }
    onClose(true);
  };

  const reloadConflict = async () => {
    await onConflict?.();
    onDirtyChange?.(false);
    setConflictPending(false);
    setConfirmState({ kind: "closed" });
    onClose(true);
  };

  const currentImage: ImagePlacement =
    imageTarget?.kind === "question"
      ? draft.image
      : imageTarget?.kind === "option"
        ? draft.options.find((option) => option.id === imageTarget.optionId)
            ?.image ?? emptyImagePlacement()
        : emptyImagePlacement();

  const applyImage = (image: ImagePlacement) => {
    if (imageTarget?.kind === "question") {
      setQuestionImage(image);
    } else if (imageTarget?.kind === "option") {
      setOptionImage(imageTarget.optionId, image);
    }
  };

  const openImagePicker = (target: Exclude<ImageTarget, null>) => {
    setImageTarget(target);
    setImagePickerOpen(true);
  };

  const questionTextError = issueFor(visibleIssues, "question_text");
  const questionImageError = issueFor(visibleIssues, "question_image");
  const timeError = issueFor(visibleIssues, "question_time");
  const pointsError = issueFor(visibleIssues, "points");
  const partialError = issueFor(visibleIssues, "partial_scoring");
  const saveState = isSaving ? "saving" : dirty ? "dirty" : "saved";
  const isPoll =
    draft.evaluationMode === "none" &&
    draft.scoringMode === "none";
  const isScored = draft.scoringMode === "points";
  const correctAnswerCount = draft.options.filter(
    (option) => option.isCorrect,
  ).length;
  const showPartialScoring =
    !isPoll &&
    isScored &&
    draft.type === "multiple" &&
    correctAnswerCount > 1;

  return (
    <>
      <aside
        className="flex h-full min-h-0 flex-col bg-surface text-content"
        aria-label={isPoll ? "تنظیمات نظرسنجی" : "تنظیمات سؤال"}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-1 pb-4">
          <div>
            <h2 className="text-base font-bold">
              {isPoll ? "تنظیمات نظرسنجی" : "تنظیمات سؤال"}
            </h2>
            <p className="mt-1 text-xs text-content-muted">
              {isPoll
                ? "نظرسنجی بدون پاسخ صحیح و امتیاز"
                : draft.type === "single"
                  ? "سؤال تک‌گزینه‌ای"
                  : "سؤال چندگزینه‌ای"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={isSaving}
            aria-label={isPoll ? "بستن تنظیمات نظرسنجی" : "بستن تنظیمات سؤال"}
            onClick={handleClose}
          >
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-5">
          {conflictPending && (
            <Notice
              tone="warning"
              className="mb-5 items-start"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmState({ kind: "reload-conflict" })}
                >
                  بارگذاری نسخه سرور
                </Button>
              }
            >
              نسخه جدیدتری از این سؤال ذخیره شده است. برای جلوگیری از بازنویسی ناخواسته،
              ذخیره دوباره تا تعیین تکلیف این تعارض غیرفعال است.
            </Notice>
          )}

          <div className="space-y-6">
            <section aria-labelledby="question-text-heading">
              <div className="flex items-center justify-between gap-3">
                <label
                  id="question-text-heading"
                  htmlFor="question-editor-text"
                  className="text-sm font-semibold"
                >
                  {isPoll ? "متن نظرسنجی" : "متن سؤال"}
                </label>
                <span className="text-xs text-content-muted">
                  {formatPersianNumber(Array.from(draft.text).length)}
                  {" / "}
                  {formatPersianNumber(QUESTION_LIMITS.text)}
                </span>
              </div>

              <div className="mt-2 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Textarea
                    ref={questionInputRef}
                    id="question-editor-text"
                    dir="auto"
                    rows={3}
                    value={draft.text}
                    maxLength={QUESTION_LIMITS.text}
                    disabled={isSaving || conflictPending}
                    aria-invalid={Boolean(questionTextError)}
                    aria-describedby={
                      questionTextError ? "question-editor-text-error" : undefined
                    }
                    onChange={(event) => setQuestionText(event.target.value)}
                    placeholder={isPoll ? "پرسش نظرسنجی را بنویسید…" : "سؤال خود را بنویسید…"}
                    className="min-h-24"
                  />
                  {questionTextError && (
                    <p
                      id="question-editor-text-error"
                      role="alert"
                      className="mt-1.5 text-xs text-danger-ink"
                    >
                      {questionTextError}
                    </p>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={isSaving || conflictPending}
                  aria-label={isPoll ? "افزودن یا تغییر تصویر نظرسنجی" : "افزودن یا تغییر تصویر سؤال"}
                  onClick={() => openImagePicker({ kind: "question" })}
                >
                  <ImageIcon aria-hidden="true" />
                  تصویر
                </Button>
              </div>

              {draft.image.url && (
                <div className="mt-3 flex items-center gap-3 rounded-panel border border-border-subtle bg-canvas p-2">
                  <ImagePlacementImage
                    image={draft.image}
                    preferred="thumbnail"
                    alt=""
                    className="size-16 shrink-0 rounded-control bg-surface object-cover"
                  />
                  <span
                    dir="ltr"
                    className="min-w-0 flex-1 truncate text-xs text-content-muted"
                  >
                    {draft.image.url}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isSaving || conflictPending}
                    aria-label={isPoll ? "حذف تصویر نظرسنجی" : "حذف تصویر سؤال"}
                    className="shrink-0 text-danger"
                    onClick={() => setQuestionImage(emptyImagePlacement())}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}
              {draft.image.url && (
                <label className="mt-3 block text-xs font-semibold">
                  متن جایگزین تصویر <span className="font-normal text-content-muted">(اختیاری)</span>
                  <Input
                    type="text"
                    dir="auto"
                    value={draft.image.altText}
                    maxLength={IMAGE_ALT_TEXT_MAX_LENGTH}
                    disabled={isSaving || conflictPending}
                    onChange={(event) =>
                      setQuestionImage({
                        ...draft.image,
                        altText: event.target.value,
                      })
                    }
                    placeholder="توضیح کوتاه تصویر"
                    className="mt-1.5 h-10"
                  />
                </label>
              )}
              {questionImageError && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {questionImageError}
                </p>
              )}
            </section>

            <QuestionOptionsEditor
              options={draft.options}
              questionType={draft.type}
              evaluationMode={draft.evaluationMode}
              disabled={isSaving || conflictPending}
              issues={visibleIssues}
              onAdd={addOption}
              onDelete={deleteOption}
              onTextChange={setOptionText}
              onToggleCorrect={toggleCorrect}
              onMove={moveOption}
              onImage={(optionId) =>
                openImagePicker({ kind: "option", optionId })
              }
              onRemoveImage={(optionId) =>
                setOptionImage(optionId, emptyImagePlacement())
              }
              onImageAltText={(optionId, value) => {
                const option = draft.options.find(
                  (candidate) => candidate.id === optionId,
                );
                if (!option) return;
                setOptionImage(optionId, {
                  ...option.image,
                  altText: value,
                });
              }}
            />

            <section
              aria-labelledby="question-time-heading"
              className="rounded-panel border border-border-subtle bg-canvas/60 p-3.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 id="question-time-heading" className="text-sm font-semibold">
                    زمان پاسخ
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-content-muted">
                    مدت زمانی که شرکت‌کنندگان برای ثبت پاسخ دارند.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label htmlFor="question-editor-time" className="sr-only">
                    زمان پاسخ به ثانیه
                  </label>
                  <Input
                    id="question-editor-time"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={draft.timeInput}
                    disabled={isSaving || conflictPending}
                    aria-invalid={Boolean(timeError)}
                    aria-describedby={
                      timeError
                        ? "question-editor-time-help question-editor-time-error"
                        : "question-editor-time-help"
                    }
                    onChange={(event) => setTimeInput(event.target.value)}
                    className="h-10 w-20 text-center font-semibold"
                  />
                  <span className="text-xs font-medium text-content-muted">ثانیه</span>
                </div>
              </div>
              <p
                id="question-editor-time-help"
                className="mt-2 text-xs leading-5 text-content-muted"
              >
                از {formatPersianNumber(QUESTION_LIMITS.minDurationSeconds)} ثانیه تا{" "}
                {formatPersianNumber(QUESTION_LIMITS.maxDurationSeconds / 60)} دقیقه.
              </p>
              {timeError && (
                <p
                  id="question-editor-time-error"
                  role="alert"
                  className="mt-1.5 text-xs text-danger-ink"
                >
                  {timeError}
                </p>
              )}
            </section>

            {!isPoll && (
              <section
                aria-labelledby="question-scoring-heading"
                className="rounded-panel border border-border-subtle bg-canvas/60 p-3.5"
              >
                <div>
                  <h3 id="question-scoring-heading" className="text-sm font-semibold">
                    امتیازدهی
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-content-muted">
                    امتیاز پاسخ صحیح و در صورت نیاز اثر سرعت را برای این سؤال تنظیم کنید.
                  </p>
                </div>

                {!isScored ? (
                  <Notice tone="info" className="mt-3 items-start">
                    این فعالیت امتیاز ندارد؛ نتیجه سؤال نمایش داده می‌شود اما در رتبه‌بندی کلی اثر نمی‌گذارد.
                  </Notice>
                ) : (
                  <>
                    <div className="mt-3">
                      <label
                        htmlFor="question-editor-max-points"
                        className="mb-1 block text-xs font-medium text-content-muted"
                      >
                        امتیاز پاسخ صحیح
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="question-editor-max-points"
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          value={draft.maxPointsInput}
                          disabled={isSaving || conflictPending}
                          aria-invalid={Boolean(pointsError)}
                          aria-describedby={
                            pointsError
                              ? "question-editor-points-help question-editor-points-error"
                              : "question-editor-points-help"
                          }
                          onChange={(event) => setMaxPointsInput(event.target.value)}
                          className="h-10 w-24 text-center font-semibold"
                        />
                        <span className="text-xs font-medium text-content-muted">
                          امتیاز
                        </span>
                      </div>
                      <p
                        id="question-editor-points-help"
                        className="mt-1.5 text-xs leading-5 text-content-muted"
                      >
                        در حالت ثابت، هر پاسخ صحیح همین امتیاز را دریافت می‌کند.
                      </p>
                    </div>

                    <label className="mt-3 flex min-h-12 cursor-pointer items-start justify-between gap-4 rounded-panel border border-border-action bg-surface p-3">
                      <span>
                        <span className="block text-sm font-medium">
                          پاسخ سریع‌تر، امتیاز بیشتر
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-content-muted">
                          امتیاز پاسخ صحیح بر اساس زمان باقی‌مانده بین حداقل و حداکثر تغییر می‌کند.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={draft.fasterAnswersMorePoints}
                        disabled={isSaving || conflictPending}
                        onChange={(event) => setFasterPoints(event.target.checked)}
                        className="mt-1 size-5 shrink-0 accent-brand"
                      />
                    </label>

                    {draft.fasterAnswersMorePoints && (
                      <div className="mt-3 rounded-panel border border-brand-border bg-brand-soft/60 p-3">
                        <label
                          htmlFor="question-editor-min-points"
                          className="mb-1 block text-xs font-medium text-brand-ink"
                        >
                          حداقل امتیاز پاسخ صحیح
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="question-editor-min-points"
                            type="text"
                            inputMode="numeric"
                            dir="ltr"
                            value={draft.minPointsInput}
                            disabled={isSaving || conflictPending}
                            aria-invalid={Boolean(pointsError)}
                            aria-describedby={
                              pointsError
                                ? "question-editor-min-points-help question-editor-points-error"
                                : "question-editor-min-points-help"
                            }
                            onChange={(event) => setMinPointsInput(event.target.value)}
                            className="h-10 w-24 text-center font-semibold"
                          />
                          <span className="text-xs font-medium text-brand-ink">
                            امتیاز
                          </span>
                        </div>
                        <p
                          id="question-editor-min-points-help"
                          className="mt-1.5 text-xs leading-5 text-brand-ink/80"
                        >
                          پاسخ‌های دیرتر به این مقدار نزدیک می‌شوند؛ پاسخ‌های سریع‌تر به امتیاز کامل.
                        </p>
                      </div>
                    )}

                    {pointsError && (
                      <p
                        id="question-editor-points-error"
                        role="alert"
                        className="mt-2 text-xs text-danger-ink"
                      >
                        {pointsError}
                      </p>
                    )}

                    {showPartialScoring && (
                      <label className="mt-3 flex min-h-12 cursor-pointer items-start justify-between gap-4 rounded-panel border border-border-action bg-surface p-3">
                        <span>
                          <span className="block text-sm font-medium">
                            امتیازدهی جزئی
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-content-muted">
                            هر انتخاب درست یک سهم امتیاز می‌گیرد و هر انتخاب نادرست یک سهم را خنثی می‌کند؛ امتیاز نهایی از صفر کمتر نمی‌شود.
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={draft.partialScoring}
                          disabled={isSaving || conflictPending}
                          onChange={(event) => setPartialScoring(event.target.checked)}
                          className="mt-1 size-5 shrink-0 accent-brand"
                        />
                      </label>
                    )}
                    {partialError && (
                      <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                        {partialError}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            <section
              aria-labelledby="question-flow-heading"
              className="rounded-panel border border-border-subtle bg-canvas/60 p-3.5"
            >
              <h3 id="question-flow-heading" className="text-sm font-semibold">
                پس از پاسخ‌گویی
              </h3>
              <p className="mt-1 text-xs leading-5 text-content-muted">
                {isPoll
                  ? "پس از بسته‌شدن، توزیع انتخاب‌ها نمایش داده می‌شود. نظرسنجی در رتبه‌بندی کلی نقشی ندارد."
                  : "پس از بسته‌شدن، نتیجه همین سؤال و پاسخ صحیح نمایش داده می‌شود. رتبه‌بندی کلی جلسه مرحله‌ای جدا از نتیجه سؤال است."}
              </p>

              {!isPoll && isScored && (
                <label className="mt-3 flex min-h-12 cursor-pointer items-start justify-between gap-4 rounded-panel border border-border-action bg-surface p-3">
                  <span>
                    <span className="block text-sm font-medium">
                      سپس رتبه‌بندی کلی را نمایش بده
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-content-muted">
                      بعد از نتیجه این سؤال، رتبه‌بندی تجمعی کل جلسه روی صفحه ارائه نمایش داده می‌شود.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.showLeaderboardAfter}
                    disabled={isSaving || conflictPending}
                    onChange={(event) => setLeaderboard(event.target.checked)}
                    className="mt-1 size-5 shrink-0 accent-brand"
                  />
                </label>
              )}

              {!isPoll && !isScored && (
                <p className="mt-2 text-xs leading-5 text-content-muted">
                  چون این فعالیت امتیازی نیست، رتبه‌بندی کلی پس از آن نمایش داده نمی‌شود.
                </p>
              )}
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 border-t border-border-subtle bg-surface/95 px-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div
            className="mb-2 min-h-5 text-xs"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {saveState === "saving" ? (
              <span className="inline-flex items-center gap-1.5 text-info">
                <LoaderCircle
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                در حال ذخیره…
              </span>
            ) : saveState === "dirty" ? (
              <span className="font-medium text-warning-ink">
                تغییرات ذخیره‌نشده دارید.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-success-ink">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                همه تغییرات ذخیره شده است.
                {lastSavedAt && (
                  <span className="text-content-muted">
                    {" "}
                    {new Intl.DateTimeFormat("fa-IR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(lastSavedAt)}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={handleClose}
            >
              {dirty ? "انصراف" : "بستن"}
            </Button>
            <Button
              disabled={!dirty || isSaving || conflictPending}
              aria-busy={isSaving || undefined}
              onClick={() => void handleSave()}
            >
              {isSaving ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
          </div>
        </footer>
      </aside>

      <LazyImagePickerDialog
        open={imagePickerOpen}
        currentAssetId={currentImage.assetId}
        title={
          imageTarget?.kind === "question"
            ? isPoll
              ? "انتخاب تصویر نظرسنجی"
              : "انتخاب تصویر سؤال"
            : "انتخاب تصویر گزینه"
        }
        description="تصویر جدید آپلود کنید یا از تصاویر قبلی خودتان استفاده کنید."
        onClose={() => setImagePickerOpen(false)}
        onSelect={(asset) => applyImage(imagePlacementFromAsset(asset))}
        onUseExternalUrl={() => setUrlDialogOpen(true)}
      />

      <ImageUrlDialog
        open={urlDialogOpen}
        initialUrl={currentImage.assetId ? "" : currentImage.url}
        title={
          imageTarget?.kind === "question"
            ? isPoll
              ? "استفاده از لینک تصویر نظرسنجی"
              : "استفاده از لینک تصویر سؤال"
            : "استفاده از لینک تصویر گزینه"
        }
        onClose={() => {
          setUrlDialogOpen(false);
          setImageTarget(null);
        }}
        onConfirm={(url) =>
          applyImage(imagePlacementFromExternalUrl(url))
        }
      />

      <ConfirmDialog
        isOpen={confirmState.kind !== "closed"}
        onClose={() => setConfirmState({ kind: "closed" })}
        onConfirm={
          confirmState.kind === "reload-conflict"
            ? reloadConflict
            : discardAndClose
        }
        title={
          confirmState.kind === "reload-conflict"
            ? "نسخه جدید سرور بارگذاری شود؟"
            : "تغییرات کنار گذاشته شود؟"
        }
        description={
          confirmState.kind === "reload-conflict"
            ? "نسخه ذخیره‌شده روی سرور جایگزین ویرایش فعلی شما می‌شود و تغییرات محلی این پنل از بین می‌رود."
            : isPoll
              ? "تغییرات ذخیره‌نشده این نظرسنجی از بین می‌رود."
              : "تغییرات ذخیره‌نشده این سؤال از بین می‌رود."
        }
        confirmText={
          confirmState.kind === "reload-conflict"
            ? "بارگذاری نسخه سرور"
            : "رد تغییرات"
        }
        cancelText="ادامه ویرایش"
        confirmVariant="destructive"
        isLoading={false}
      />
    </>
  );
}

export default function QuestionInspector(props: QuestionInspectorProps) {
  if (
    !props.slide ||
    props.slide.item_kind !== "activity" ||
    props.slide.activity_kind !== "choice" ||
    props.slide.schema_version !== 1 ||
    !props.slide.question
  ) {
    return (
      <Notice tone="warning" className="m-3">
        برای ویرایش، ابتدا یک اسلاید سؤال معتبر انتخاب کنید.
      </Notice>
    );
  }

  return <QuestionInspectorInner {...props} />;
}
