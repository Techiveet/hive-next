// app/(auth)/two-factor/page.tsx

import TwoFactorClient from "./two-factor-client";
import { getCurrentSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

type TwoFactorPageProps = {
  // In Next.js 15+, searchParams is a Promise
  searchParams: Promise<{
    callbackURL?: string;
  }>;
};

export default async function TwoFactorPage(props: TwoFactorPageProps) {
  // 1. Await the searchParams promise
  const searchParams = await props.searchParams;

  const { user } = await getCurrentSession();

  if (!user) {
    redirect("/sign-in");
  }

  // 2. Now you can safely access properties
  const raw = searchParams?.callbackURL;

  const callbackURL =
    raw && raw !== "/"
      ? decodeURIComponent(raw)
      : "/dashboard";

  // 3. Render the client component
  return <TwoFactorClient callbackURL={callbackURL} />;
}