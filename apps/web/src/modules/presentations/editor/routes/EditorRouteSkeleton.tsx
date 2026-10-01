export default function EditorRouteSkeleton() {
  return (
    <div
      className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-brand-soft text-content"
      dir="rtl"
      aria-busy="true"
      aria-label="در حال آماده‌سازی ویرایشگر"
    >
      <div className="h-16 shrink-0 border-b border-border-subtle bg-surface px-4 shadow-sm md:px-6">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4">
          <div className="h-9 w-28 animate-pulse rounded-control bg-brand-muted motion-reduce:animate-none" />
          <div className="h-9 w-40 animate-pulse rounded-control bg-brand-soft motion-reduce:animate-none" />
        </div>
      </div>
      <main className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 gap-3 overflow-hidden p-3 xl:grid-cols-[224px_minmax(0,1fr)] xl:gap-3">
        <aside className="hidden min-h-0 overflow-hidden rounded-panel border border-border-subtle bg-surface p-4 xl:block">
          <div className="mb-5 h-5 w-20 animate-pulse rounded-control bg-brand-soft motion-reduce:animate-none" />
          <div className="aspect-video animate-pulse rounded-panel bg-brand-soft motion-reduce:animate-none" />
          <div className="mt-4 aspect-video animate-pulse rounded-panel bg-canvas motion-reduce:animate-none" />
        </aside>
        <section className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-panel border border-border-subtle bg-surface p-4 sm:p-6">
          <div className="w-full max-w-xl text-center" role="status" aria-live="polite">
            <div className="mx-auto h-16 w-16 animate-pulse rounded-panel bg-brand-muted motion-reduce:animate-none" />
            <p className="mt-5 text-lg font-bold">در حال آماده‌سازی ویرایشگر…</p>
            <p className="mt-2 text-sm text-content-muted">ساختار ارائه تا چند لحظه دیگر آماده است.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
