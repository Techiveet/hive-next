// app/(dashboard)/page.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <>
      {/* Top stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border bg-card text-foreground shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Active tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">3</div>
            <p className="mt-1 text-xs text-muted-foreground">
              +1 new tenant this week
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card text-foreground shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">12,480</div>
            <p className="mt-1 text-xs text-muted-foreground">
              99.8% success rate
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card text-foreground shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-emerald-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Error rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">0.2%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lower section */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 border border-border bg-card text-foreground shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li>• Acme Corp tenant superadmin logged in.</li>
              <li>• Central superadmin created a new tenant.</li>
              <li>• Beta Labs updated billing settings.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card text-foreground shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <button className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-400">
              Create tenant
            </button>
            <button className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent">
              Invite user
            </button>
            <button className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent">
              View audit log
            </button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
