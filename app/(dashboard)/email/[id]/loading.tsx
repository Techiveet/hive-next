
// app/(dashboard)/email/[id]/loading.tsx
export default function EmailDetailLoading() {
  return (
    <>
      {/* Left: Email List Column Loading */}
      <div className="hidden lg:block h-full w-[380px] min-w-0 border-r border-slate-200 dark:border-slate-800 print:hidden">
        <div className="flex h-full flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
            <div className="relative">
              <div className="h-9 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
          
          {/* Email List Loading */}
          <div className="flex-1 p-2 space-y-2">
            {[...Array(8)].map((_, i) => (
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
          
          {/* Pagination Loading */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-7 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Email Detail Column Loading */}
      <div className="flex-1">
        <div className="flex h-full flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Email Header Loading */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
            
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          </div>
          
          {/* Email Body Loading */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
            
            {/* Attachments Loading */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
                      <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Email Footer Loading */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}