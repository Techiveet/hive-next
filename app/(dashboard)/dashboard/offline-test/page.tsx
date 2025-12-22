"use client";

import dynamic from "next/dynamic";

const OfflineTestClient = dynamic(
  () => import("./offline-test-client").then((m) => m.OfflineTestClient),
  { ssr: false }
);

export default function Page() {
  return <OfflineTestClient />;
}
