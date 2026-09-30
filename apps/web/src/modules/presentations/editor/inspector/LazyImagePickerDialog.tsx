import {
  Suspense,
  lazy,
  useEffect,
  useState,
} from "react";

import type { ImagePickerDialogProps } from "./ImagePickerDialog.tsx";

const ImagePickerDialog = lazy(
  () => import("./ImagePickerDialog.tsx"),
);

export default function LazyImagePickerDialog(
  props: ImagePickerDialogProps,
) {
  const [activated, setActivated] = useState(props.open);

  useEffect(() => {
    if (props.open) setActivated(true);
  }, [props.open]);

  if (!activated && !props.open) return null;

  return (
    <Suspense fallback={null}>
      <ImagePickerDialog {...props} />
    </Suspense>
  );
}
