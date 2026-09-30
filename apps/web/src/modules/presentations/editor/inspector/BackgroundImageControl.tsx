import {
  Image as ImageIcon,
  Images,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import LazyImagePickerDialog from "./LazyImagePickerDialog.tsx";
import ImageUrlDialog from "./ImageUrlDialog.tsx";

type BackgroundImageControlProps = {
  backgroundColor: string;
  imageUrl: string;
  assetId: string;
  focalX?: number;
  focalY?: number;
  disabled?: boolean;
  maxUrlLength?: number;
  onChange: (url: string, assetId: string) => void;
};

export default function BackgroundImageControl({
  backgroundColor,
  imageUrl,
  assetId,
  focalX = 0.5,
  focalY = 0.5,
  disabled = false,
  maxUrlLength = 4_096,
  onChange,
}: BackgroundImageControlProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);

  const externalInitialUrl =
    assetId || !/^https?:\/\//i.test(imageUrl) ? "" : imageUrl;

  return (
    <>
      <div className="mt-3 rounded-panel border border-border-subtle bg-canvas p-3">
        {imageUrl ? (
          <div className="flex items-center gap-3">
            <div
              className="h-20 w-28 shrink-0 rounded-control border border-border-subtle bg-cover bg-center"
              style={{
                backgroundColor,
                backgroundImage: `url(${JSON.stringify(imageUrl)})`,
                backgroundPosition:
                  `${Math.round(focalX * 100)}% ${Math.round(focalY * 100)}%`,
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
              <p className="mt-1 text-xs leading-5 text-content-muted">
                {assetId
                  ? "این فایل را می‌توانید بدون آپلود مجدد در ارائه‌های دیگر هم استفاده کنید."
                  : "برای پایداری بیشتر، در انتخاب‌گر می‌توانید یک فایل را در ProSlides ذخیره کنید."}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-3 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-surface text-content-muted">
              <ImageIcon className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-2 text-sm font-semibold">
              تصویر پس‌زمینه‌ای انتخاب نشده است
            </p>
            <p className="mt-1 text-xs leading-5 text-content-muted">
              فایل جدید آپلود کنید یا از تصاویر قبلی خودتان استفاده کنید.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant={imageUrl ? "outline" : "default"}
            size="sm"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            <Images aria-hidden="true" />
            {imageUrl ? "تغییر تصویر" : "انتخاب تصویر"}
          </Button>
          {imageUrl ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              disabled={disabled}
              onClick={() => onChange("", "")}
            >
              <Trash2 aria-hidden="true" />
              حذف
            </Button>
          ) : null}
        </div>
      </div>

      <LazyImagePickerDialog
        open={pickerOpen}
        matteColor={backgroundColor}
        currentAssetId={assetId}
        title="انتخاب تصویر پس‌زمینه"
        description="تصویر جدید آپلود کنید یا بدون آپلود مجدد از تصاویر قبلی خودتان استفاده کنید."
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => onChange(asset.url, asset.id)}
        onUseExternalUrl={() => setUrlDialogOpen(true)}
      />

      <ImageUrlDialog
        open={urlDialogOpen}
        initialUrl={externalInitialUrl}
        title="استفاده از لینک تصویر پس‌زمینه"
        maxLength={maxUrlLength}
        onClose={() => setUrlDialogOpen(false)}
        onConfirm={(url) => onChange(url, "")}
      />
    </>
  );
}
