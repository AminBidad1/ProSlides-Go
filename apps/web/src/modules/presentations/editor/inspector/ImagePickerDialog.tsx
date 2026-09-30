import {
  Check,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

import { ApiError } from "../../../../shared/api/http.ts";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { useNativeDialogLifecycle } from "../../../../shared/ui/useNativeDialogLifecycle.ts";
import {
  listImageAssets,
  mediaThumbnailUrl,
  type MediaAsset,
  uploadImageAsset,
} from "../../api/mediaRepository.ts";
import {
  ImagePreparationError,
  prepareImageUpload,
} from "../lib/prepareImageUpload.ts";

export type ImagePickerDialogProps = {
  open: boolean;
  currentAssetId?: string;
  matteColor?: string;
  title?: string;
  description?: string;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  onUseExternalUrl?: () => void;
};

const uploadErrorMessage = (error: unknown): string => {
  if (error instanceof ImagePreparationError) {
    switch (error.code) {
      case "too_large":
        return "حجم تصویر بیش از ۱۵ مگابایت است.";
      case "unsupported":
        return "فعلاً فایل JPEG یا PNG انتخاب کنید.";
      case "decode_failed":
        return "این فایل به‌عنوان تصویر معتبر باز نشد.";
      case "encode_failed":
        return "بهینه‌سازی تصویر در مرورگر انجام نشد.";
    }
  }

  if (error instanceof ApiError) {
    switch (error.code) {
      case "media_too_large":
        return "تصویر پس از پردازش هنوز بیش از حد بزرگ است.";
      case "image_dimensions_invalid":
        return "ابعاد این تصویر بیش از حد بزرگ است.";
      case "invalid_image":
        return "سرور این فایل را به‌عنوان تصویر معتبر نپذیرفت.";
      case "media_storage_unavailable":
        return "فضای ذخیره‌سازی تصویر موقتاً در دسترس نیست.";
    }
  }

  if (error instanceof TypeError) {
    return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
  }

  return "آپلود تصویر انجام نشد. دوباره تلاش کنید.";
};

function AssetThumbnail({ asset }: { asset: MediaAsset }) {
  const [failed, setFailed] = useState(false);
  const src = mediaThumbnailUrl(asset);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-canvas text-content-muted">
        <ImageIcon className="size-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function ImagePickerDialog({
  open,
  currentAssetId = "",
  matteColor = "#ffffff",
  title = "انتخاب تصویر",
  description =
    "تصویر جدید آپلود کنید یا بدون آپلود مجدد از تصاویر قبلی خودتان استفاده کنید.",
  onClose,
  onSelect,
  onUseExternalUrl,
}: ImagePickerDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const listAbortRef = useRef<AbortController | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const [items, setItems] = useState<MediaAsset[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const close = useCallback(() => {
    listAbortRef.current?.abort();
    uploadAbortRef.current?.abort();
    setUploading(false);
    setDragActive(false);
    onClose();
  }, [onClose]);

  const {
    dialogRef,
    handleCancel,
    handleClose,
  } = useNativeDialogLifecycle({
    open,
    onRequestClose: close,
    initialFocus: () => uploadButtonRef.current,
  });

  const loadPage = useCallback(
    async (cursor: string, append: boolean) => {
      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      if (append) setLoadingMore(true);
      else setLoading(true);
      setLibraryError("");

      try {
        const page = await listImageAssets(
          cursor,
          18,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setItems((current) => {
          if (!append) return page.items;
          const ids = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...page.items.filter((item) => !ids.has(item.id)),
          ];
        });
        setNextCursor(page.next_cursor ?? "");
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException &&
            error.name === "AbortError")
        ) {
          return;
        }
        setLibraryError(
          "تصاویر قبلی بارگذاری نشدند. می‌توانید دوباره تلاش کنید یا تصویر جدیدی آپلود کنید.",
        );
      } finally {
        if (listAbortRef.current === controller) {
          listAbortRef.current = null;
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    setUploadError("");
    setDragActive(false);
    void loadPage("", false);
  }, [loadPage, open]);

  useEffect(
    () => () => {
      listAbortRef.current?.abort();
      uploadAbortRef.current?.abort();
    },
    [],
  );

  const upload = async (file: File) => {
    if (uploading) return;

    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploading(true);
    setUploadError("");

    try {
      const prepared = await prepareImageUpload(file, matteColor);
      if (controller.signal.aborted) return;

      const asset = await uploadImageAsset(
        prepared,
        file.name || "image",
        controller.signal,
      );
      if (controller.signal.aborted) return;

      onSelect(asset);
      close();
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException &&
          error.name === "AbortError")
      ) {
        return;
      }
      setUploadError(uploadErrorMessage(error));
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
        setUploading(false);
      }
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      aria-labelledby="image-media-picker-title"
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-auto max-h-[min(90dvh,54rem)] w-[min(calc(100vw-1rem),48rem)] overflow-hidden rounded-panel border border-border-subtle bg-surface-raised p-0 text-content shadow-panel backdrop:bg-content/35 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[min(90dvh,54rem)] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-6">
          <div>
            <h2
              id="image-media-picker-title"
              className="text-lg font-bold"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-content-muted">
              {description}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="بستن انتخاب‌گر تصویر"
            onClick={close}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="sr-only"
            aria-label="انتخاب فایل تصویر"
            disabled={uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void upload(file);
            }}
          />

          <div
            className={
              "rounded-panel border border-dashed p-4 transition sm:p-5 " +
              (dragActive
                ? "border-brand bg-brand/5"
                : "border-border-subtle bg-canvas")
            }
            onDragEnter={(event) => {
              event.preventDefault();
              if (!uploading) setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                setDragActive(false);
              }
            }}
            onDrop={handleDrop}
            aria-busy={uploading || undefined}
          >
            <div className="flex flex-col items-center text-center sm:flex-row sm:text-right">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-content-muted">
                <Upload className="size-5" aria-hidden="true" />
              </span>
              <div className="mt-3 min-w-0 flex-1 sm:mr-3 sm:mt-0">
                <p className="text-sm font-bold">تصویر جدید</p>
                <p className="mt-1 text-xs leading-5 text-content-muted">
                  JPEG یا PNG، حداکثر ۱۵ مگابایت. نسخه‌های مناسب نمایش به‌صورت خودکار در سرور ساخته می‌شوند.
                </p>
              </div>
              <Button
                ref={uploadButtonRef}
                className="mt-3 shrink-0 sm:mr-4 sm:mt-0"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <LoaderCircle
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    در حال آپلود…
                  </>
                ) : (
                  <>
                    <Upload aria-hidden="true" />
                    انتخاب فایل
                  </>
                )}
              </Button>
            </div>
            {uploadError ? (
              <p className="mt-3 text-sm text-danger-ink" role="alert">
                {uploadError}
              </p>
            ) : null}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold">تصاویر اخیر شما</h3>
            <p className="mt-1 text-xs leading-5 text-content-muted">
              یک تصویر می‌تواند در چند بخش و چند ارائه استفاده شود؛ انتخاب مجدد فایل تازه‌ای ایجاد نمی‌کند.
            </p>
          </div>

          {loading ? (
            <div
              className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
              aria-label="در حال بارگذاری تصاویر قبلی"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-panel border border-border-subtle"
                  aria-hidden="true"
                >
                  <div className="aspect-video animate-pulse bg-canvas motion-reduce:animate-none" />
                  <div className="space-y-2 p-2.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-canvas motion-reduce:animate-none" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-canvas motion-reduce:animate-none" />
                  </div>
                </div>
              ))}
            </div>
          ) : libraryError && items.length === 0 ? (
            <div
              className="mt-3 rounded-panel border border-border-subtle bg-canvas p-4 text-sm"
              role="alert"
            >
              <p className="leading-6 text-content-muted">
                {libraryError}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void loadPage("", false)}
              >
                تلاش دوباره
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="mt-3 rounded-panel border border-border-subtle bg-canvas p-5 text-center">
              <ImageIcon
                className="mx-auto size-6 text-content-muted"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold">
                هنوز تصویری ذخیره نکرده‌اید
              </p>
              <p className="mt-1 text-xs leading-5 text-content-muted">
                اولین آپلود از این به بعد در همه انتخاب‌گرهای تصویر قابل استفاده خواهد بود.
              </p>
            </div>
          ) : (
            <>
              {libraryError ? (
                <p
                  className="mt-3 text-xs leading-5 text-danger-ink"
                  role="alert"
                >
                  {libraryError}
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((asset) => {
                  const selected = asset.id === currentAssetId;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={
                        selected
                          ? `تصویر ${asset.filename || "بدون نام"}؛ در حال استفاده`
                          : `استفاده از تصویر ${asset.filename || "بدون نام"}`
                      }
                      className="group overflow-hidden rounded-panel border border-border-subtle bg-surface text-right outline-none transition hover:border-brand/50 focus-visible:ring-2 focus-visible:ring-focus aria-pressed:border-brand aria-pressed:ring-1 aria-pressed:ring-brand"
                      onClick={() => {
                        onSelect(asset);
                        close();
                      }}
                    >
                      <div className="relative aspect-video overflow-hidden bg-canvas">
                        <AssetThumbnail asset={asset} />
                        {selected ? (
                          <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-brand text-white shadow-sm">
                            <Check className="size-4" aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                      <div className="p-2.5">
                        <p
                          className="truncate text-xs font-semibold"
                          title={asset.filename || "تصویر"}
                        >
                          {asset.filename || "تصویر"}
                        </p>
                        <p
                          dir="ltr"
                          className="mt-1 text-[11px] tabular-nums text-content-muted"
                        >
                          {asset.width} × {asset.height}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {nextCursor ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    aria-busy={loadingMore || undefined}
                    onClick={() => void loadPage(nextCursor, true)}
                  >
                    {loadingMore ? (
                      <>
                        <LoaderCircle
                          className="animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        در حال بارگذاری…
                      </>
                    ) : (
                      "نمایش تصاویر بیشتر"
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {onUseExternalUrl ? (
            <Button
              variant="ghost"
              disabled={uploading}
              onClick={() => {
                close();
                onUseExternalUrl();
              }}
            >
              <Link2 aria-hidden="true" />
              استفاده از لینک خارجی
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="outline"
            disabled={uploading}
            onClick={close}
          >
            بستن
          </Button>
        </div>
      </div>
    </dialog>
  );
}
