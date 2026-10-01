import * as React from "react";

import { cn } from "../../lib/cn.ts";

type FieldFrameProps = React.HTMLAttributes<HTMLDivElement> & {
  invalid?: boolean;
};

export const FieldFrame = React.forwardRef<HTMLDivElement, FieldFrameProps>(
  ({ className, invalid = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "group flex min-h-12 items-stretch overflow-hidden rounded-control border bg-surface transition-colors",
        "focus-within:ring-2 focus-within:ring-focus/25",
        invalid
          ? "border-danger focus-within:border-danger"
          : "border-border-field hover:border-border-field-strong focus-within:border-focus",
        className,
      )}
      {...props}
    />
  ),
);

FieldFrame.displayName = "FieldFrame";

type FieldAdornmentProps = React.HTMLAttributes<HTMLSpanElement>;

export const FieldAdornment = React.forwardRef<
  HTMLSpanElement,
  FieldAdornmentProps
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "flex h-12 w-12 shrink-0 items-center justify-center border-e border-border-subtle text-content-muted transition-colors",
      "group-focus-within:text-content",
      className,
    )}
    {...props}
  />
));

FieldAdornment.displayName = "FieldAdornment";

type FieldActionProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const FieldAction = React.forwardRef<HTMLButtonElement, FieldActionProps>(
  ({ className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center text-content-muted transition-colors",
        "hover:bg-surface-inset hover:text-content",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
        "disabled:cursor-not-allowed disabled:text-content-muted",
        className,
      )}
      {...props}
    />
  ),
);

FieldAction.displayName = "FieldAction";
