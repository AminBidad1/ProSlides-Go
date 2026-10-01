import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { cn } from "../../lib/cn.ts";
import { textareaVariants } from "./textarea.variants.ts";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof textareaVariants>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, resize, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(textareaVariants({ resize, className }))}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
