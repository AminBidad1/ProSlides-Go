import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { cn } from "../../lib/cn.ts";
import { inputVariants } from "./input.variants.ts";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputVariants({ size, className }))}
      {...props}
    />
  ),
);

Input.displayName = "Input";
