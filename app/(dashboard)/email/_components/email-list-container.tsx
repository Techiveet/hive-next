// app/(dashboard)/email/_components/email-list-container.tsx

import { EmailList } from "./email-list";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export async function EmailListContainer({
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

  const cookieStore = await cookies();

  // ✅ Forward every cookie, not just auth_session
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const params = new URLSearchParams({
    folder,
    pageSize: pageSize.toString(),
    q: searchQuery,
  });
  if (cursor) params.set("cursor", cursor);

  // You can keep baseUrl OR use relative. Keeping yours:
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/emails?${params.toString()}`, {
      headers: { cookie: cookieHeader }, // ✅ correct header key for Node fetch
      cache: "no-store",
      next: { tags: ["emails"] },
    });

    if (!res.ok) throw new Error(await res.text());

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
  } catch {
    return (
      <EmailList
        initialEmails={[]}
        currentUserId={user.id}
        folderName={folder}
        totalCount={0}
      />
    );
  }
}
