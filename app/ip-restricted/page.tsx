import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function IpRestrictedPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-slate-900">
      <div className="flex max-w-md flex-col items-center text-center p-6 bg-white rounded-lg shadow-lg border">
        <div className="rounded-full bg-rose-100 p-4 mb-4">
            <ShieldAlert className="h-10 w-10 text-rose-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Access Denied</h1>
        <p className="text-sm text-slate-500 mb-6">
          Your IP address is not authorized to access this workspace. 
          Please contact your administrator if you believe this is an error.
        </p>
        <div className="flex gap-2">
            <Button asChild variant="outline">
                <Link href="/sign-in">Back to Login</Link>
            </Button>
        </div>
      </div>
    </div>
  );
}