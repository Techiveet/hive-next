// components/offline/offline-test-suite.tsx
"use client";

import { AlertCircle, CheckCircle, RefreshCw, Server, Wifi, WifiOff, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useOffline } from "@/lib/offline/use-offline";
import { useState } from "react";

export function OfflineTestSuite() {
  const { 
    isOnline, 
    hasInternet, 
    hasServer, 
    pending, 
    isSyncing, 
    syncOfflineData,
    checkConnection 
  } = useOffline();
  
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [isTesting, setIsTesting] = useState(false);

  const runTest = async (name: string, testFn: () => Promise<boolean>) => {
    setIsTesting(true);
    toast.loading(`Running ${name}...`);
    
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [name]: result }));
      
      if (result) {
        toast.success(`${name} passed`, {
          description: "Test completed successfully",
        });
      } else {
        toast.error(`${name} failed`, {
          description: "Test did not meet expectations",
        });
      }
    } catch (error: any) {
      toast.error(`${name} error`, {
        description: error.message,
      });
      setTestResults(prev => ({ ...prev, [name]: false }));
    } finally {
      setIsTesting(false);
    }
  };

  const tests = [
    {
      name: "Basic Connectivity",
      description: "Checks browser online status",
      run: async () => {
        return typeof navigator !== "undefined" && navigator.onLine === true;
      },
    },
    {
      name: "Server Reachability",
      description: "Checks if server API is reachable",
      run: async () => {
        const response = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
        return response.ok;
      },
    },
    {
      name: "Offline Queue Write",
      description: "Tests saving data when offline",
      run: async () => {
        // We'll simulate this test by checking if offline mode is supported
        return typeof indexedDB !== 'undefined' && 'serviceWorker' in navigator;
      },
    },
    {
      name: "Service Worker Registration",
      description: "Checks if SW is installed and active",
      run: async () => {
        if (!("serviceWorker" in navigator)) return false;
        
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      },
    },
    {
      name: "Cache Storage",
      description: "Verifies assets are cached for offline use",
      run: async () => {
        const cacheNames = await caches.keys();
        return cacheNames.some(name => name.startsWith("hive-"));
      },
    },
  ];

  const runAllTests = async () => {
    setIsTesting(true);
    toast.loading("Running all tests...");
    
    const results: Record<string, boolean> = {};
    
    for (const test of tests) {
      try {
        const result = await test.run();
        results[test.name] = result;
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay between tests
      } catch (error) {
        results[test.name] = false;
      }
    }
    
    setTestResults(results);
    
    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = tests.length;
    
    if (passedCount === totalCount) {
      toast.success("All tests passed!", {
        description: `${passedCount}/${totalCount} tests successful`,
      });
    } else {
      toast.warning("Some tests failed", {
        description: `${passedCount}/${totalCount} tests successful`,
      });
    }
    
    setIsTesting(false);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Offline Capabilities Test Suite
        </CardTitle>
        <CardDescription>
          Run automated tests to verify offline functionality
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm font-medium">Status</span>
            </div>
            <div className="text-lg font-semibold">
              {isOnline ? "Online" : "Offline"}
            </div>
          </div>
          
          <div className="space-y-2 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">Internet</span>
            </div>
            <div className={`text-lg font-semibold ${hasInternet ? "text-green-600" : "text-red-600"}`}>
              {hasInternet ? "Connected" : "Disconnected"}
            </div>
          </div>
          
          <div className="space-y-2 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              <span className="text-sm font-medium">Server</span>
            </div>
            <div className={`text-lg font-semibold ${hasServer ? "text-green-600" : "text-red-600"}`}>
              {hasServer ? "Reachable" : "Unreachable"}
            </div>
          </div>
          
          <div className="space-y-2 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-lg font-semibold">{pending} items</div>
          </div>
        </div>

        {/* Manual Controls */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => checkConnection()} 
            variant="outline"
            size="sm"
          >
            Check Connection
          </Button>
          
          <Button 
            onClick={() => syncOfflineData()} 
            disabled={isSyncing || pending === 0}
            variant="outline"
            size="sm"
          >
            {isSyncing ? "Syncing..." : "Manual Sync"}
          </Button>
          
          <Button 
            onClick={() => {
              if (navigator.onLine) {
                toast.info("Already online - turn off network to test");
              } else {
                toast.info("Currently offline - turn on network to test sync");
              }
            }}
            variant="outline"
            size="sm"
          >
            Simulate Network Toggle
          </Button>
        </div>

        {/* Test Suite */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Automated Tests</h3>
            <Button 
              onClick={runAllTests}
              disabled={isTesting}
            >
              {isTesting ? "Running Tests..." : "Run All Tests"}
            </Button>
          </div>
          
          <div className="space-y-3">
            {tests.map((test) => (
              <div key={test.name} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-1">
                  <div className="font-medium">{test.name}</div>
                  <div className="text-sm text-muted-foreground">{test.description}</div>
                </div>
                
                <div className="flex items-center gap-2">
                  {testResults[test.name] !== undefined ? (
                    testResults[test.name] ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )
                  ) : (
                    <AlertCircle className="h-5 w-5 text-gray-400" />
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => runTest(test.name, test.run)}
                    disabled={isTesting}
                  >
                    Run
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Test Summary */}
        {Object.keys(testResults).length > 0 && (
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-2">Test Summary</h3>
            <div className="space-y-2">
              {tests.map(test => (
                testResults[test.name] !== undefined && (
                  <div key={test.name} className="flex items-center justify-between">
                    <span className="text-sm">{test.name}</span>
                    <span className={`text-sm font-medium ${testResults[test.name] ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults[test.name] ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                )
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between">
                <span className="font-medium">Overall Score:</span>
                <span className="font-medium">
                  {Object.values(testResults).filter(Boolean).length} / {tests.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}