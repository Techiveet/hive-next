// app/(dashboard)/email/loading.tsx
export default function EmailListLoading() {
  return (
    <div className="h-full w-full lg:w-[380px] min-w-0">
      <div className="h-full flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header skeleton */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse ml-2" />
            </div>
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>

        {/* Email list skeleton */}
        <div className="flex-1 p-2 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 p-4">
              <div className="pt-1">
                <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}