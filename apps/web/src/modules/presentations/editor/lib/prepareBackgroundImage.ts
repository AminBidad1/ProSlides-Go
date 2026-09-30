const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_LONG_EDGE = 3840;
const THUMBNAIL_LONG_EDGE = 480;

type BackgroundImagePreparationErrorCode =
  | "unsupported"
  | "too_large"
  | "decode_failed"
  | "encode_failed";

export class BackgroundImagePreparationError extends Error {
  readonly code: BackgroundImagePreparationErrorCode;

  constructor(code: BackgroundImagePreparationErrorCode) {
    super(code);
    this.name = "BackgroundImagePreparationError";
    this.code = code;
  }
}

type PreparedBackgroundImage = {
  master: Blob;
  thumbnail: Blob;
};

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

const hasSupportedExtension = (name: string): boolean =>
  /\.(?:jpe?g|png)$/i.test(name.trim());

const loadImage = async (file: File): Promise<LoadedImage> => {
  if (typeof createImageBitmap === "function") {
    try {
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
      } catch {
        bitmap = await createImageBitmap(file);
      }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall through to HTMLImageElement for browsers with partial support.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image decode failed"));
    });
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new BackgroundImagePreparationError("decode_failed");
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(objectUrl),
  };
};

const canvasBlob = (
  canvas: HTMLCanvasElement,
  mimeType: "image/jpeg" | "image/png",
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new BackgroundImagePreparationError("encode_failed"));
      },
      mimeType,
      mimeType === "image/jpeg" ? 0.9 : undefined,
    );
  });

const scaledSize = (
  width: number,
  height: number,
  maxLongEdge: number,
) => {
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const renderBlob = async (
  loaded: LoadedImage,
  size: { width: number; height: number },
  mimeType: "image/jpeg" | "image/png",
  matteColor: string,
): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d", {
    alpha: mimeType === "image/png",
  });
  if (!context) {
    throw new BackgroundImagePreparationError("encode_failed");
  }

  if (mimeType === "image/jpeg") {
    context.fillStyle = matteColor;
    context.fillRect(0, 0, size.width, size.height);
  }
  context.drawImage(
    loaded.source,
    0,
    0,
    size.width,
    size.height,
  );

  return canvasBlob(canvas, mimeType);
};

export async function prepareBackgroundImage(
  file: File,
  matteColor: string,
): Promise<PreparedBackgroundImage> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new BackgroundImagePreparationError("too_large");
  }

  if (
    file.type &&
    file.type !== "image/jpeg" &&
    file.type !== "image/png"
  ) {
    throw new BackgroundImagePreparationError("unsupported");
  }
  if (!file.type && !hasSupportedExtension(file.name)) {
    throw new BackgroundImagePreparationError("unsupported");
  }

  const outputMime =
    file.type === "image/png" || /\.png$/i.test(file.name)
      ? "image/png"
      : "image/jpeg";

  const loaded = await loadImage(file);
  try {
    if (
      loaded.width <= 0 ||
      loaded.height <= 0 ||
      !Number.isFinite(loaded.width) ||
      !Number.isFinite(loaded.height)
    ) {
      throw new BackgroundImagePreparationError("decode_failed");
    }

    const master = await renderBlob(
      loaded,
      scaledSize(loaded.width, loaded.height, MAX_LONG_EDGE),
      outputMime,
      matteColor,
    );
    if (master.size > MAX_INPUT_BYTES) {
      throw new BackgroundImagePreparationError("too_large");
    }

    const thumbnail = await renderBlob(
      loaded,
      scaledSize(
        loaded.width,
        loaded.height,
        THUMBNAIL_LONG_EDGE,
      ),
      outputMime,
      matteColor,
    );

    return { master, thumbnail };
  } finally {
    loaded.dispose();
  }
}
