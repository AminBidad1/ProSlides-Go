const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_LONG_EDGE = 3840;

type ImagePreparationErrorCode =
  | "unsupported"
  | "too_large"
  | "decode_failed"
  | "encode_failed";

export class ImagePreparationError extends Error {
  readonly code: ImagePreparationErrorCode;

  constructor(code: ImagePreparationErrorCode) {
    super(code);
    this.name = "ImagePreparationError";
    this.code = code;
  }
}

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

const hasSupportedExtension = (name: string): boolean =>
  /.(?:jpe?g|png)$/i.test(name.trim());

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
      // Fall through for browsers with incomplete createImageBitmap support.
    }
  }

  const objectURL = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectURL;

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image decode failed"));
    });
  } catch {
    URL.revokeObjectURL(objectURL);
    throw new ImagePreparationError("decode_failed");
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(objectURL),
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
        else reject(new ImagePreparationError("encode_failed"));
      },
      mimeType,
      mimeType === "image/jpeg" ? 0.9 : undefined,
    );
  });

export async function prepareImageUpload(
  file: File,
  matteColor = "#ffffff",
): Promise<Blob> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImagePreparationError("too_large");
  }

  if (
    file.type &&
    file.type !== "image/jpeg" &&
    file.type !== "image/png"
  ) {
    throw new ImagePreparationError("unsupported");
  }
  if (!file.type && !hasSupportedExtension(file.name)) {
    throw new ImagePreparationError("unsupported");
  }

  const mimeType =
    file.type === "image/png" || /.png$/i.test(file.name)
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
      throw new ImagePreparationError("decode_failed");
    }

    const scale = Math.min(
      1,
      MAX_LONG_EDGE / Math.max(loaded.width, loaded.height),
    );
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", {
      alpha: mimeType === "image/png",
    });
    if (!context) {
      throw new ImagePreparationError("encode_failed");
    }

    if (mimeType === "image/jpeg") {
      context.fillStyle = matteColor;
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(loaded.source, 0, 0, width, height);

    const blob = await canvasBlob(canvas, mimeType);
    if (blob.size > MAX_INPUT_BYTES) {
      throw new ImagePreparationError("too_large");
    }
    return blob;
  } finally {
    loaded.dispose();
  }
}
