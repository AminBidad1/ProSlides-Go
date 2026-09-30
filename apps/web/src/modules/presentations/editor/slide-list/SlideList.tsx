import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  CheckCircle2,
  GripVertical,
  Trash2,
  Trophy,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import type { EditorSlide } from "../../model/editor.ts";
import { getEditorItemBehaviors } from "../../model/itemRegistry.ts";
import { useOptionalDesignDraft } from "../model/useDesignDraftContext.ts";
import {
  buildSlideListItems,
  getSlideListTitle,
  getSlideListTypeLabel,
  type SlideListItem,
} from "../model/slideListModel.ts";

type SlidesPanelProps = {
  slides: EditorSlide[];
  activeSlideId: string | null;
  onSelectSlide: (slideId: string) => void;
  addNewSlide: () => void;
  deleteSlide: (slideId: string) => void | Promise<void>;
  quizBackground?: string;
  quizBackgroundImage?: string;
  quizBackgroundFocalX?: number;
  quizBackgroundFocalY?: number;
  isReordering: boolean;
  reorderDisabled?: boolean;
  onReorder: (
    sourceIndex: number,
    destinationIndex: number,
  ) => void | Promise<void>;
};

export default function SlidesPanel({
  slides,
  activeSlideId,
  onSelectSlide,
  addNewSlide,
  deleteSlide,
  quizBackground = "#ffffff",
  quizBackgroundImage = "",
  quizBackgroundFocalX = 0.5,
  quizBackgroundFocalY = 0.5,
  isReordering,
  reorderDisabled = false,
  onReorder,
}: SlidesPanelProps) {
  const designController = useOptionalDesignDraft();
  const [deleteTarget, setDeleteTarget] =
    useState<SlideListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const displaySlides = useMemo(
    () => buildSlideListItems(slides),
    [slides],
  );

  const getSlideBackground = (): CSSProperties => {
    const backgroundImage =
      designController?.draft.backgroundImageUrl ?? quizBackgroundImage;
    const backgroundColor =
      designController?.draft.backgroundColor ?? quizBackground;
    const focalX =
      designController?.draft.backgroundImageFocalX ??
      quizBackgroundFocalX;
    const focalY =
      designController?.draft.backgroundImageFocalY ??
      quizBackgroundFocalY;

    if (backgroundImage) {
      return {
        backgroundColor: backgroundColor || "#f3f4f6",
        backgroundImage:
          `linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.18)), url(${JSON.stringify(backgroundImage)})`,
        backgroundSize: "cover",
        backgroundPosition:
          `${Math.round(focalX * 100)}% ${Math.round(focalY * 100)}%`,
      };
    }

    return {
      backgroundColor: backgroundColor || "#f3f4f6",
    };
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    void onReorder(result.source.index, result.destination.index);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteSlide(deleteTarget.slide_id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const structuralActionsDisabled = isReordering || reorderDisabled;

  return (
    <div className="w-full" aria-label="فهرست آیتم‌های ارائه">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-800">آیتم‌ها</h2>
        {isReordering ? (
          <span
            className="animate-pulse text-xs text-brand motion-reduce:animate-none"
            role="status"
          >
            در حال مرتب‌سازی…
          </span>
        ) : reorderDisabled ? (
          <span className="text-xs text-content-muted">
            برای مرتب‌سازی، تغییرات را ذخیره یا رها کنید.
          </span>
        ) : null}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="editor-items">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-3"
            >
              {displaySlides.map((slide, index) => {
                const slideBackground = getSlideBackground();
                const slideTitle = getSlideListTitle(slide);
                const typeLabel = getSlideListTypeLabel(slide);
                const behaviors = getEditorItemBehaviors(slide);
                const isActive = slide.slide_id === activeSlideId;
                const dragDisabled = structuralActionsDisabled;

                return (
                  <Draggable
                    key={slide.slide_id}
                    draggableId={slide.slide_id}
                    index={index}
                    isDragDisabled={dragDisabled}
                  >
                    {(provided, snapshot) => {
                      const mergedStyle: CSSProperties = {
                        ...provided.draggableProps.style,
                        ...slideBackground,
                        transform: snapshot.isDragging
                          ? `${provided.draggableProps.style?.transform || ""} rotate(2deg)`
                          : provided.draggableProps.style?.transform,
                        boxShadow: snapshot.isDragging
                          ? "0 10px 25px rgba(0, 0, 0, 0.2)"
                          : "none",
                      };

                      return (
                        <div
                          {...provided.draggableProps}
                          ref={provided.innerRef}
                          className={`group relative mx-auto aspect-[16/9] w-full max-w-[360px] overflow-hidden rounded-xl border bg-surface shadow-sm transition ${
                            isActive
                              ? "border-brand ring-2 ring-brand/20"
                              : "border-border-subtle hover:border-brand-border hover:shadow-md"
                          } ${dragDisabled ? "opacity-90" : ""} ${
                            snapshot.isDragging ? "z-50" : "z-0"
                          }`}
                          style={mergedStyle}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectSlide(slide.slide_id)}
                            aria-label={`انتخاب آیتم ${slideTitle}`}
                            aria-pressed={isActive}
                            className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                          >
                            <span className="sr-only">
                              انتخاب آیتم {slideTitle}
                            </span>
                          </button>

                          {!dragDisabled && (
                            <div
                              {...provided.dragHandleProps}
                              aria-label={`جابه‌جایی آیتم ${slideTitle}`}
                              title="جابه‌جایی آیتم"
                              onMouseDown={(event) =>
                                event.stopPropagation()
                              }
                              className="absolute right-11 top-2 z-20 cursor-grab rounded-lg border border-border-subtle bg-surface/95 p-1.5 shadow-sm transition hover:bg-surface active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus xl:opacity-0 xl:group-hover:opacity-100 xl:group-focus-within:opacity-100"
                            >
                              <GripVertical
                                className="h-5 w-5 text-gray-700"
                                aria-hidden="true"
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            aria-label={`حذف آیتم ${slideTitle}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(slide);
                            }}
                            disabled={structuralActionsDisabled}
                            title={
                              reorderDisabled
                                ? "ابتدا تغییرات ذخیره‌نشده را ذخیره یا رها کنید."
                                : undefined
                            }
                            className="absolute right-2 top-2 z-20 rounded-lg border border-border-subtle bg-surface/95 p-2 text-danger shadow-sm transition hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 xl:opacity-0 xl:group-hover:opacity-100 xl:group-focus-within:opacity-100"
                          >
                            <Trash2
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </button>

                          <span className="absolute left-2 top-2 z-20 inline-flex min-w-7 items-center justify-center rounded-lg border border-border-subtle bg-surface/95 px-1.5 py-1 text-[10px] font-black text-content-muted shadow-sm">
                            {formatPersianNumber(index + 1)}
                          </span>

                          {behaviors.length > 0 && (
                            <div className="absolute left-10 top-2 z-20 flex max-w-[52%] flex-wrap justify-end gap-1">
                              {behaviors.map((behavior) => (
                                <span
                                  key={behavior.id}
                                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[9px] font-semibold ${
                                    behavior.tone === "warning"
                                      ? "border-warning-border bg-warning-soft text-warning-ink"
                                      : "border-info-border bg-info-soft text-info"
                                  }`}
                                >
                                  {behavior.id === "overall-ranking" ? (
                                    <Trophy className="h-3 w-3" aria-hidden="true" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  )}
                                  {behavior.label}
                                </span>
                              ))}
                            </div>
                          )}

                          <div
                            className="absolute left-2 right-2 top-10 overflow-hidden rounded-lg bg-white/90 p-2 text-center text-xs font-semibold leading-5 text-black/90 backdrop-blur-sm"
                            style={{
                              maxHeight: "110px",
                              wordBreak: "break-word",
                              WebkitLineClamp: 6,
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            <bdi>{slideTitle}</bdi>
                          </div>

                          <div className="absolute bottom-2 left-2 right-2 space-y-1 text-center text-xs">
                            <div className="rounded-md bg-white/90 py-1 font-medium text-gray-700 backdrop-blur-sm">
                              {typeLabel}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </Draggable>
                );
              })}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <button
        type="button"
        onClick={addNewSlide}
        disabled={structuralActionsDisabled}
        title={
          reorderDisabled
            ? "ابتدا تغییرات ذخیره‌نشده را ذخیره یا رها کنید."
            : undefined
        }
        className="mx-auto mt-3 flex min-h-11 w-full max-w-[360px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-soft/50 px-3 py-2.5 text-center text-sm font-bold text-brand-strong transition hover:border-brand hover:bg-brand-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        + افزودن آیتم
      </button>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="حذف آیتم"
        description="مطمئنید می‌خواهید این آیتم را حذف کنید؟"
        confirmText="حذف"
        cancelText="انصراف"
        confirmVariant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
