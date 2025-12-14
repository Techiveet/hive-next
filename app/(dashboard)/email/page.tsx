// app/(dashboard)/email/page.tsx

import { EmailList } from "./_components/email-list";
import { Mail } from "lucide-react";
import { Suspense } from "react";
import { getCurrentSession } from "@/lib/auth-server";
import { headers } from "next/headers"; // <--- CHANGED: Use headers instead of cookies
import { redirect } from "next/navigation";

// ---------------- Skeleton while list loads ----------------
function EmailListLoading() {
  return (
    <div className="h-full w-full lg:w-[380px] min-w-0">
      <div className="flex h-full flex-col rounded-xl bg-white dark:bg-slate-900 border overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
        </div>
        <div className="flex-1 p-2 space-y-2">
          {[...Array(8)].map((_, i) => (
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
      </div>
    </div>
  );
}

// ---------------- Server Component wrapper around EmailList ----------------
async function EmailListServer({
  folder,
  cursor,
  pageSize = 10,
  searchQuery = "",
}: {
  folder: string;
  cursor: string | null;
  pageSize: number;
  searchQuery?: string;
}) {
  const { user } = await getCurrentSession();
  if (!user) redirect("/sign-in");

  // 1. Get the full cookie string from the request headers
  // This forwards ALL cookies (session, etc.) regardless of their name
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie") || "";

  // Construct URL parameters
  const params = new URLSearchParams({
    folder,
    pageSize: pageSize.toString(),
    q: searchQuery,
  });
  if (cursor) params.set("cursor", cursor);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    // 2. Pass the cookie header to the API call
    const res = await fetch(`${baseUrl}/api/emails?${params.toString()}`, {
      headers: {
        Cookie: cookieHeader, // Forwarding the exact cookies we received
      },
      next: { tags: ["emails"] },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch emails:", res.status, res.statusText);
      // Return empty list on error instead of crashing
      return (
        <EmailList
          initialEmails={[]}
          currentUserId={user.id}
          folderName={folder}
          totalCount={0}
        />
      );
    }

    const { data } = await res.json();

    return (
      <EmailList
        initialEmails={data?.items || []}
        currentUserId={user.id}
        folderName={folder}
        nextCursor={data?.nextCursor}
        pageSize={pageSize}
        searchQuery={searchQuery}
        totalCount={data?.totalCount || 0}
      />
    );
  } catch (error) {
    console.error("EmailListServer error:", error);
    return (
      <div className="h-full w-full lg:w-[380px] min-w-0 flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-slate-500">Failed to load emails.</p>
        </div>
      </div>
    );
  }
}

// ---------------- Main Page Layout ----------------
export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    folder?: string;
    cursor?: string;
    pageSize?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const folder = params.folder || "inbox";
  const cursor = params.cursor || null;
  const pageSize = Math.min(parseInt(params.pageSize || "10"), 20);
  const q = params.q || "";

  return (
    <>
      {/* Middle: Email list (sidebar lives in layout.tsx) */}
      <div className="h-full w-full lg:w-[380px] min-w-0">
        <Suspense fallback={<EmailListLoading />}>
          <EmailListServer
            folder={folder}
            cursor={cursor}
            pageSize={pageSize}
            searchQuery={q}
          />
        </Suspense>
      </div>

      {/* Right placeholder when no email selected (desktop) */}
      <div className="hidden flex-1 lg:flex h-full flex-col items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-8 text-center">
        <div className="relative mb-6 rounded-full bg-slate-50 p-6 dark:bg-slate-800">
          <Mail className="h-12 w-12 text-slate-300" />
          <div className="absolute right-5 top-5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Select an email to read
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
          Choose a message from the list to view its details.
        </p>
      </div>
    </>
  );
}