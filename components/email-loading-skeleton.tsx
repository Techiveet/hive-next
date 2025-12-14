// components/email-loading-skeleton.tsx
export function EmailLoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex-1 p-2 space-y-2">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex gap-3 p-4 animate-pulse">
          <div className="pt-1">
            <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}