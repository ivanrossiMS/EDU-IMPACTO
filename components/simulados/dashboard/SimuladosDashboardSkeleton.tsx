'use client'

/** Shimmer skeleton mirroring the Bento + Split dashboard geometry to prevent layout shift. */
export function SimuladosDashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800/80" />
          <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/80" />
          <div className="h-10 w-40 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800" />
        </div>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[126px] animate-pulse rounded-[18px] border border-slate-200/70 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/60"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-[20px] border border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="h-14 border-b border-slate-200/70 px-5 py-3 dark:border-slate-800" />
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex flex-1 items-center gap-3.5">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/60 dark:bg-slate-800/70" />
                  </div>
                </div>
                <div className="hidden h-7 w-28 animate-pulse rounded-full bg-slate-200/70 sm:block dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-64 animate-pulse rounded-[20px] border border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60" />
          <div className="h-48 animate-pulse rounded-[20px] border border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60" />
        </div>
      </div>
    </div>
  )
}
