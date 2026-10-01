import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-content-inverse shadow-sm hover:bg-brand-strong disabled:bg-brand-muted disabled:text-content-muted disabled:shadow-none",
        destructive:
          "bg-danger text-content-inverse shadow-sm hover:brightness-95 disabled:bg-danger-soft disabled:text-danger-ink disabled:shadow-none",
        outline:
          "border border-border-action bg-surface text-content hover:border-border-action-strong hover:bg-surface-inset disabled:border-border-subtle disabled:bg-surface-inset disabled:text-content-muted",
        secondary:
          "bg-brand-soft text-brand-ink hover:bg-brand-muted disabled:bg-surface-inset disabled:text-content-muted",
        ghost:
          "text-content hover:bg-brand-soft hover:text-brand-ink disabled:text-content-muted",
        inverse:
          "bg-content-inverse text-stage shadow-sm hover:bg-canvas disabled:opacity-60 disabled:shadow-none",
        inverseOutline:
          "border border-stage-border bg-stage-soft text-content-inverse hover:border-stage-muted hover:bg-stage-border disabled:opacity-60",
        inverseGhost:
          "text-content-inverse hover:bg-stage-soft disabled:opacity-60",
        link:
          "text-brand underline-offset-4 hover:text-brand-strong hover:underline disabled:text-content-muted disabled:no-underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
