import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Check,
  House,
  LoaderCircle,
  Play,
  Share2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../../../shared/api/http.ts";
import { fa } from "../../../../shared/i18n/fa";
import type { NoticeTone } from "../../../../shared/ui/Notice.tsx";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { Input } from "../../../../shared/ui/primitives/Input.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import type { EditorPresentation } from "../../model/editor.ts";
import ShareMenu from "../../sharing/ShareDialog.tsx";
import type { EditorSaveState } from "../model/useEditorStatus.ts";

type EditorHeaderProps = {
  accessCode?: string;
  quizTitle?: string;
  quizId: string;
  quizRevision: number;
  onNotify?: (
    message: string,
    tone?: NoticeTone,
    pending?: boolean,
  ) => void;
  onBack?: () => void;
  onPresent?: () => void;
  presentDisabled?: boolean;
  presentReason?: string;
  onQuizUpdated?: (quiz: EditorPresentation) => void;
  onConflict?: () => void | Promise<void>;
  onAccessCodeSaved?: (accessCode: string) => void;
  saveState?: EditorSaveState;
};

export default function QuizHeader({
  accessCode = "ABC123",
  quizTitle = "",
  quizId,
  quizRevision,
  onNotify,
  onBack,
  onPresent,
  presentDisabled = false,
  presentReason,
  onQuizUpdated,
  onConflict,
  onAccessCodeSaved,
  saveState = "saved",
}: EditorHeaderProps) {
  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);
  const shareButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const saveStateLabel =
    saveState === "conflict"
      ? "تعارض ویرایش"
      : saveState === "dirty"
        ? "ذخیره‌نشده"
        : "ذخیره‌شده";

  useEffect(() => {
    setNewQuizTitle(quizTitle || "");
  }, [quizTitle]);

  const handleUpdateQuizName = async () => {
    if (!quizId) {
      onNotify?.("شناسه ارائه معتبر نیست.", "error");
      setIsEditing(false);
      return;
    }

    if (!newQuizTitle || typeof newQuizTitle !== "string") {
      onNotify?.("یک نام معتبر وارد کنید.", "error");
      return;
    }

    const trimmedTitle = newQuizTitle.trim();

    if (!trimmedTitle || trimmedTitle === quizTitle) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    onNotify?.("در حال ذخیره نام ارائه…", "info", true);
    try {
      const updatedQuiz = await quizService.updateQuiz(quizId, {
        title: trimmedTitle,
        revision: quizRevision,
      });
      onQuizUpdated?.(updatedQuiz);
      onNotify?.("نام ارائه ذخیره شد.", "success");
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        await onConflict?.();
        onNotify?.(
          "این ارائه جای دیگری تغییر کرده است. آخرین نسخه بارگذاری شد.",
          "warning",
        );
        return;
      }

      setNewQuizTitle(quizTitle || "");

      if (error instanceof ApiError) {
        onNotify?.(
          `خطای ذخیره: ${error.data?.message || "ذخیره نام انجام نشد."}`,
          "error",
        );
      } else if (error instanceof TypeError) {
        onNotify?.("ارتباط با سرور برقرار نشد.", "error");
      } else {
        onNotify?.("خطای پیش‌بینی‌نشده‌ای رخ داد.", "error");
      }
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setNewQuizTitle(quizTitle || "");
    setIsEditing(false);
  };

  const closeShareDialog = () => {
    setShowShareModal(false);
    window.requestAnimationFrame(() => shareButtonRef.current?.focus());
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNewQuizTitle(event.target.value || "");
  };

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 h-16 w-full border-b border-brand-border bg-surface/95 px-3 shadow-sm backdrop-blur md:px-4"
        dir="rtl"
      >
        <div className="grid h-full w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : navigate("/manager/panel"))}
              className="grid size-10 shrink-0 place-items-center rounded-control text-content-muted transition hover:bg-brand-soft hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              title="بازگشت به ارائه‌ها"
              aria-label="بازگشت به ارائه‌ها"
            >
              <House className="size-5" aria-hidden="true" />
            </button>
            <div
              className="hidden items-center gap-1.5 font-brand text-base font-bold text-brand-ink before:text-xl before:text-brand before:content-['✱'] lg:flex"
              dir="ltr"
            >
              ProSlides
            </div>
          </div>

          <div className="min-w-0 justify-self-center">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="block max-w-[38vw] truncate rounded-control px-3 py-2 text-sm font-bold text-content transition hover:bg-brand-soft hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:max-w-sm lg:max-w-md"
                title="تغییر نام ارائه"
                dir="auto"
              >
                {quizTitle || fa.editor.untitledPresentation}
              </button>
            ) : (
              <div className="flex min-w-0 items-center gap-1 rounded-control border border-brand-border bg-surface p-1 shadow-sm">
                <Input
                  type="text"
                  value={newQuizTitle || ""}
                  onChange={handleInputChange}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleUpdateQuizName();
                    if (event.key === "Escape") handleCancelEdit();
                  }}
                  autoFocus
                  disabled={isUpdating}
                  dir="auto"
                  size="sm"
                  className="w-32 min-w-0 sm:w-56 lg:w-72"
                  placeholder="نام ارائه"
                />
                <button
                  type="button"
                  onClick={() => void handleUpdateQuizName()}
                  disabled={isUpdating || !newQuizTitle.trim()}
                  className="grid size-9 shrink-0 place-items-center rounded-control bg-success text-content-inverse transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                  title="ذخیره نام"
                  aria-label="ذخیره نام"
                >
                  {isUpdating ? (
                    <LoaderCircle
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check className="size-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                  className="grid size-9 shrink-0 place-items-center rounded-control text-content-muted transition hover:bg-brand-soft hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                  title="انصراف"
                  aria-label="انصراف از تغییر نام"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold lg:inline-flex ${
                saveState === "conflict"
                  ? "bg-danger-soft text-danger"
                  : saveState === "dirty"
                    ? "bg-warning-soft text-warning-ink"
                    : "bg-canvas text-content-muted"
              }`}
              role="status"
              aria-live="polite"
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {saveStateLabel}
            </span>

            <Button
              ref={shareButtonRef}
              type="button"
              variant="outline"
              onClick={() => setShowShareModal(true)}
              title={fa.editor.openShare}
              aria-label={fa.editor.share}
              className="px-3 font-bold sm:px-4"
            >
              <Share2 aria-hidden="true" />
              <span className="hidden sm:inline">{fa.editor.share}</span>
            </Button>

            <Button
              type="button"
              onClick={onPresent}
              disabled={!onPresent}
              aria-disabled={presentDisabled || undefined}
              title={presentReason || "شروع ارائه"}
              className="px-3.5 font-bold aria-disabled:opacity-70 sm:px-4"
            >
              <Play className="fill-current" aria-hidden="true" />
              اجرا
            </Button>
          </div>
        </div>
      </header>

      <ShareMenu
        quizId={quizId}
        isOpen={showShareModal}
        onClose={closeShareDialog}
        accessCode={accessCode}
        onAccessCodeSaved={onAccessCodeSaved}
      />
    </>
  );
}
