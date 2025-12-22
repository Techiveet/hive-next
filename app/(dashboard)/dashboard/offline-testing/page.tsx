// app/(dashboard)/dashboard/offline-testing/page.tsx

import { NetworkTestPanel } from "@/components/offline/network-test-panel";
import { OfflineTestSuite } from "@/components/offline/offline-test-suite";

export default function OfflineTestingPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Advanced Offline Testing</h1>
        <p className="text-muted-foreground">
          Diagnostic tools for offline functionality
        </p>
      </div>
      
      <OfflineTestSuite />
      <NetworkTestPanel />
      
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Testing Instructions</h2>
        
        <div className="grid gap-4">
          <div className="space-y-2">
            <h3 className="font-medium">Basic Testing</h3>
            <p className="text-sm text-muted-foreground">
              For basic offline testing, visit the{' '}
              <a href="/dashboard/offline-test" className="text-blue-600 hover:underline">
                Offline Test Module
              </a>
            </p>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-medium">What to Verify</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Forms submit successfully when offline</li>
              <li>Pending items sync automatically when back online</li>
              <li>UI shows appropriate status indicators</li>
              <li>Toasts provide clear feedback</li>
              <li>App loads from cache when completely offline</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}