import { cva } from "class-variance-authority";

export const inputVariants = cva(
  [
    "min-w-0 w-full rounded-control border border-border-control bg-surface text-content outline-none",
    "transition-colors placeholder:text-content-muted",
    "hover:border-border-control-strong",
    "focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/25",
    "aria-[invalid=true]:border-danger",
    "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-content-muted disabled:opacity-70",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-9 px-2.5 text-xs",
        default: "h-11 px-3 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);
