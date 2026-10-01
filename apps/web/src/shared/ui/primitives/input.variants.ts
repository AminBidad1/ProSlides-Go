import { cva } from "class-variance-authority";

export const inputVariants = cva(
  [
    "min-w-0 w-full rounded-control border outline-none transition-colors",
    "focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/25",
    "aria-[invalid=true]:border-danger",
    "disabled:cursor-not-allowed disabled:opacity-70",
  ].join(" "),
  {
    variants: {
      tone: {
        default:
          "border-border-field bg-surface text-content placeholder:text-content-muted hover:border-border-field-strong disabled:bg-surface-inset disabled:text-content-muted",
        dark:
          "border-stage-border bg-stage text-content-inverse placeholder:text-stage-muted hover:border-stage-muted disabled:bg-stage-soft disabled:text-stage-muted",
      },
      size: {
        sm: "h-9 px-2.5 text-xs",
        default: "h-11 px-3 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "default",
    },
  },
);
