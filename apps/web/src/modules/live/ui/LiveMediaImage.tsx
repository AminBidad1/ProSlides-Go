import { useState } from "react";

import {
  imageDeliveryURL,
  type ImageDelivery,
  type ImagePlacement,
} from "../../../shared/media/image.ts";

type LiveMediaImageProps = {
  src?: string;
  image?: ImagePlacement;
  preferred?: ImageDelivery;
  alt: string;
  className?: string;
};

export function LiveMediaImage({
  src = "",
  image,
  preferred = "master",
  alt,
  className = "",
}: LiveMediaImageProps) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const resolvedAlt = image?.altText || alt;
  const masterSrc = image?.url || src;
  const preferredSrc = image?.url
    ? imageDeliveryURL(image, preferred)
    : masterSrc;
  const preferredFailed =
    Boolean(preferredSrc) && failedSources.includes(preferredSrc);
  const currentSrc =
    preferredFailed && preferredSrc !== masterSrc
      ? masterSrc
      : preferredSrc;
  const failed =
    !currentSrc || failedSources.includes(currentSrc);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={resolvedAlt ? `${resolvedAlt} بارگذاری نشد` : "تصویر بارگذاری نشد"}
        className={`${className} grid place-items-center border border-[color:var(--live-border)] bg-black/20 p-3 text-center text-xs font-bold text-[color:var(--live-muted)]`}
      >
        تصویر بارگذاری نشد
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={resolvedAlt}
      className={className}
      referrerPolicy="no-referrer"
      draggable={false}
      style={
        image?.url
          ? {
              objectPosition:
                `${image.focalX * 100}% ${image.focalY * 100}%`,
            }
          : undefined
      }
      onError={() =>
        setFailedSources((current) =>
          current.includes(currentSrc)
            ? current
            : [...current, currentSrc],
        )
      }
    />
  );
}
