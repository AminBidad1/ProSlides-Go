import {
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

import { ApiError } from "../../../../shared/api/http.ts";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { uploadBackgroundAsset } from "../../api/mediaRepository.ts";
import {
  BackgroundImagePreparationError,
  prepareBackgroundImage,
} from "../lib/prepareBackgroundImage.ts";
import ImageUrlDialog from "./ImageUrlDialog.tsx";

type BackgroundImageControlProps = {
  backgroundColor: string;
  imageUrl: string;
  assetId: string;
  disabled?: boolean;
  maxUrlLength?: number;
  onChange: (url: string, assetId: string) => void;
};

const uploadErrorMessage = (error: unknown): string => {
  if (error instanceof BackgroundImagePreparationError) {
    switch (error.code) {
      case "too_large":
        return "حجم تصویر بیش از ۱۵ مگابایت است.";
      case "unsupported":
        return "برای پس‌زمینه فعلاً فایل JPEG یا PNG انتخاب کنید.";
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
        return "ابعاد این تصویر برای پس‌زمینه بیش از حد بزرگ است.";
      case "invalid_image":
        return "سرور این فایل را به‌عنوان تصویر معتبر نپذیرفت.";
      case "media_storage_unavailable":
        return "فضای ذخیره‌سازی تصویر موقتاً در دسترس نیست. تصویر فعلی حفظ شده است.";
    }
  }

  if (error instanceof TypeError) {
    return "ارتباط با سرور برقرار نشد. تصویر فعلی حفظ شده است.";
  }

  return "آپلود تصویر انجام نشد. تصویر فعلی حفظ شده است.";
};

export default function BackgroundImageControl({
  backgroundColor,
  imageUrl,
  assetId,
  disabled = false,
  maxUrlLength = 4_096,
  onChange,
}: BackgroundImageControlProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);

  useEffect(
    () => () => {
      uploadAbortRef.current?.abort();
    },
    [],
  );

  const upload = async (file: File) => {
    if (disabled || uploading) return;

    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploading(true);
    setError("");

    try {
      const prepared = await prepareBackgroundImage(
        file,
        backgroundColor,
      );
      if (controller.signal.aborted) return;

      const asset = await uploadBackgroundAsset(
        prepared,
        prepared.type === "image/png"
          ? "background.png"
          : "background.jpg",
        controller.signal,
      );
      if (controller.signal.aborted) return;

      onChange(asset.url, asset.id);
    } catch (uploadError) {
      if (
        controller.signal.aborted ||
        (uploadError instanceof DOMException &&
          uploadError.name === "AbortError")
      ) {
        return;
      }
      setError(uploadErrorMessage(uploadError));
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
    if (disabled || uploading) return;

    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const externalInitialUrl =
    assetId || !/^https?:\/\//i.test(imageUrl) ? "" : imageUrl;

  return (
    <>
      <div
        className={
          "mt-3 rounded-panel border p-3 transition " +
          (dragActive
            ? "border-brand bg-brand/5"
            : "border-border-subtle bg-canvas")
        }
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragActive(false);
          }
        }}
        onDrop={handleDrop}
        aria-busy={uploading || undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          aria-label="انتخاب فایل تصویر پس‌زمینه"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void upload(file);
          }}
        />

        {imageUrl ? (
          <div className="flex items-center gap-3">
            <div
              className="h-20 w-28 shrink-0 rounded-control border border-border-subtle bg-cover bg-center"
              style={{
                backgroundColor,
                backgroundImage: `url(${JSON.stringify(imageUrl)})`,
              }}
              role="img"
              aria-label="پیش‌نمایش تصویر پس‌زمینه"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {assetId
                  ? "تصویر در ProSlides ذخیره شده است"
                  : "تصویر از لینک خارجی استفاده می‌کند"}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-content-muted">
                {assetId
                  ? "نسخه ذخیره‌شده immutable است؛ جایگزینی، فایل جدیدی ایجاد می‌کند."
                  : "برای پایداری بیشتر می‌توانید آن را با فایل آپلودشده جایگزین کنید."}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-3 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-surface text-content-muted">
              <ImageIcon className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-2 text-sm font-semibold">
              تصویر را اینجا رها کنید
            </p>
            <p className="mt-1 text-xs text-content-muted">
              یا از دستگاه انتخاب کنید.
            </p>
          </div>
        )}

        {uploading ? (
          <div
            className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-control bg-surface px-3 text-sm font-semibold text-content-muted"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            در حال بهینه‌سازی و آپلود تصویر…
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant={imageUrl ? "outline" : "default"}
              size="sm"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              {imageUrl ? "جایگزینی فایل" : "انتخاب فایل"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => setUrlDialogOpen(true)}
            >
              <Link2 aria-hidden="true" />
              استفاده از لینک
            </Button>
            {imageUrl ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                disabled={disabled}
                onClick={() => {
                  setError("");
                  onChange("", "");
                }}
              >
                <Trash2 aria-hidden="true" />
                حذف
              </Button>
            ) : null}
          </div>
        )}

        <p className="mt-3 text-center text-xs leading-5 text-content-muted">
          JPEG یا PNG، حداکثر ۱۵ مگابایت. تصاویر بزرگ پیش از آپلود تا حداکثر
          ۳۸۴۰ پیکسل بهینه می‌شوند.
        </p>

        {error ? (
          <p
            className="mt-2 text-center text-sm text-danger-ink"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      <ImageUrlDialog
        open={urlDialogOpen}
        initialUrl={externalInitialUrl}
        title="استفاده از لینک تصویر پس‌زمینه"
        maxLength={maxUrlLength}
        onClose={() => setUrlDialogOpen(false)}
        onConfirm={(url) => {
          setError("");
          onChange(url, "");
        }}
      />
    </>
  );
}
