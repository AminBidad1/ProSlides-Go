import * as React from "react";

import { cn } from "../../lib/cn.ts";

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 min-w-0 rounded-control border border-border-field bg-surface px-3 text-sm text-content outline-none transition-colors",
        "hover:border-border-field-strong focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/25",
        "aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-surface-inset disabled:text-content-muted disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = "Select";
