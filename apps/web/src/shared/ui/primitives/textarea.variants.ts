import { cva } from "class-variance-authority";

export const textareaVariants = cva(
  [
    "min-w-0 w-full rounded-control border px-3 py-2.5 text-sm leading-6 outline-none transition-colors",
    "focus-visible:ring-2",
    "disabled:cursor-not-allowed disabled:opacity-70",
  ].join(" "),
  {
    variants: {
      tone: {
        default: [
          "border-border-field bg-surface text-content placeholder:text-content-muted",
          "hover:border-border-field-strong focus-visible:border-focus focus-visible:ring-focus/25",
          "aria-[invalid=true]:border-danger disabled:bg-surface-inset disabled:text-content-muted",
        ].join(" "),
        dark: [
          "border-stage-border bg-stage text-content-inverse placeholder:text-stage-muted",
          "hover:border-stage-muted focus-visible:border-stage-muted focus-visible:ring-stage-muted/35",
          "aria-[invalid=true]:border-danger disabled:bg-stage-soft disabled:text-stage-muted",
        ].join(" "),
        live: [
          "border-[color:var(--live-border)] live-theme-overlay-soft text-[color:var(--live-fg)] placeholder:text-[color:var(--live-muted)]",
          "hover:border-[color:var(--live-control-border)] focus-visible:border-[color:var(--live-control-border)] focus-visible:ring-[color:var(--live-focus)]",
          "aria-[invalid=true]:border-warning disabled:text-[color:var(--live-muted)]",
        ].join(" "),
      },
      resize: {
        vertical: "resize-y",
        none: "resize-none",
      },
    },
    defaultVariants: {
      tone: "default",
      resize: "vertical",
    },
  },
);
