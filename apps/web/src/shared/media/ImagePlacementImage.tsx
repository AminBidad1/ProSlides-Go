import {
  useState,
  type ImgHTMLAttributes,
} from "react";

import {
  imageDeliveryURL,
  type ImageDelivery,
  type ImagePlacement,
} from "./image.ts";

type ImagePlacementImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  image: ImagePlacement;
  preferred: ImageDelivery;
};

export function ImagePlacementImage({
  image,
  preferred,
  onError,
  referrerPolicy = "no-referrer",
  style,
  ...props
}: ImagePlacementImageProps) {
  const preferredSrc = imageDeliveryURL(image, preferred);
  const [failedPreferredSrc, setFailedPreferredSrc] =
    useState<string | null>(null);
  const useMaster =
    preferredSrc !== image.url &&
    failedPreferredSrc === preferredSrc;
  const src = useMaster ? image.url : preferredSrc;

  return (
    <img
      {...props}
      src={src}
      referrerPolicy={referrerPolicy}
      style={{
        ...style,
        objectPosition: `${image.focalX * 100}% ${image.focalY * 100}%`,
      }}
      onError={(event) => {
        if (!useMaster && preferredSrc !== image.url) {
          setFailedPreferredSrc(preferredSrc);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
