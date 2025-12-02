// app/(errors)/access-denied/page.tsx

import { ErrorStatusPage } from "@/components/errors/error-status-page";
import { ShieldAlert } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <ErrorStatusPage
      statusCode="403"
      title="Access denied"
      description={
        <>
          Your account doesn&apos;t have permission to access this area of{" "}
          <span className="font-medium text-emerald-300">Hive</span>. <br />
          If you think this is a mistake, contact your administrator.
        </>
      }
      primaryAction={{ href: "/dashboard", label: "Back to dashboard" }}
      secondaryAction={{
        href: "/sign-in?callbackURL=/dashboard&switch=1",
        label: "Switch account",
      }}
      // iconName="lock"  <-- remove this
      Icon={ShieldAlert}
    />
  );
}
