import type { ReactNode } from "react";

type EditorShellProps = {
  header: ReactNode;
  itemRail: ReactNode;
  canvas: ReactNode;
  topActions?: ReactNode;
  inspector?: ReactNode;
  toolbar: ReactNode;
  mobileItemRail?: ReactNode;
  isMobile: boolean;
  children?: ReactNode;
};

export default function EditorShell({
  header,
  itemRail,
  canvas,
  topActions,
  inspector,
  toolbar,
  mobileItemRail,
  isMobile,
  children,
}: EditorShellProps) {
  return (
    <div
      className="relative flex h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-brand-soft to-canvas pb-20 pt-16 text-content xl:pb-0"
      dir="rtl"
      style={{ fontFamily: '"Vazirmatn", "Segoe UI", sans-serif' }}
      data-editor-shell="v2"
    >
      {header}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3 xl:flex-row">
        {!isMobile && (
          <aside
            aria-label="فهرست آیتم‌ها"
            data-editor-region="item-rail"
            className="h-full w-56 shrink-0 overflow-y-auto rounded-2xl border border-brand-border bg-surface p-3 shadow-sm 2xl:w-60"
          >
            {itemRail}
          </aside>
        )}

        <main
          className="relative min-h-0 min-w-0 flex-1"
          data-editor-region="canvas"
          aria-label="بوم ویرایش"
        >
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-brand-border bg-surface p-3 shadow-sm">
            {topActions && (
              <div
                className="flex shrink-0 items-center justify-end gap-2 pb-3"
                data-editor-region="top-actions"
              >
                {topActions}
              </div>
            )}
            <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-brand-soft/40">
              {canvas}
            </div>
          </div>
        </main>

        {inspector && (
          <section
            aria-label="بازرس آیتم"
            data-editor-region="inspector"
            className="fixed inset-x-0 bottom-0 top-16 z-50 w-full overflow-y-auto border border-border-subtle bg-surface p-4 shadow-panel xl:static xl:h-full xl:w-72 xl:shrink-0 xl:rounded-2xl xl:p-3 2xl:w-80"
            style={
              isMobile
                ? {
                    top: "calc(4rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            {inspector}
          </section>
        )}

        {toolbar}
      </div>

      {mobileItemRail}
      {children}
    </div>
  );
}
