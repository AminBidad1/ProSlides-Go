import { useState } from "react";

type LiveMediaImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function LiveMediaImage({
  src,
  alt,
  className = "",
}: LiveMediaImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt ? `${alt} بارگذاری نشد` : "تصویر بارگذاری نشد"}
        className={`${className} grid place-items-center border border-[color:var(--live-border)] bg-black/20 p-3 text-center text-xs font-bold text-[color:var(--live-muted)]`}
      >
        تصویر بارگذاری نشد
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailedSrc(src)}
    />
  );
}
