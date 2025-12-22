// components/offline/network-test-panel.tsx
"use client";

import { AlertCircle, CloudOff, Globe, RefreshCw, Server, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useOffline } from "@/lib/offline/use-offline";
import { useState } from "react";

export function NetworkTestPanel() {
  const { isOnline, hasInternet, hasServer, pending, isSyncing, syncOfflineData, checkConnection } = useOffline();
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, boolean | string>>({});

  const runNetworkTest = async (testName: string) => {
    setIsTesting(true);
    
    try {
      switch (testName) {
        case 'internet':
          const internetResult = await testInternetConnection();
          setTestResults(prev => ({ ...prev, internet: internetResult }));
          toast.success("Internet test completed", {
            description: internetResult ? "Internet connection detected" : "No internet connection"
          });
          break;
          
        case 'server':
          const serverResult = await testServerConnection();
          setTestResults(prev => ({ ...prev, server: serverResult }));
          toast.success("Server test completed", {
            description: serverResult ? "Server is reachable" : "Server is unreachable"
          });
          break;
          
        case 'cache':
          const cacheResult = await testCache();
          setTestResults(prev => ({ ...prev, cache: cacheResult }));
          toast.success("Cache test completed");
          break;
          
        case 'serviceworker':
          const swResult = await testServiceWorker();
          setTestResults(prev => ({ ...prev, serviceworker: swResult }));
          toast.success("Service Worker test completed");
          break;
      }
    } catch (error) {
      toast.error(`Test ${testName} failed`, {
        description: error.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testInternetConnection = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `https://www.google.com/favicon.ico?t=${Date.now()}`;
      setTimeout(() => resolve(false), 3000);
    });
  };

  const testServerConnection = async (): Promise<string> => {
    try {
      const start = Date.now();
      const response = await fetch('/api/health', {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000)
      });
      const end = Date.now();
      const latency = end - start;
      
      return response.ok ? `OK (${latency}ms)` : `Error: ${response.status}`;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  };

  const testCache = async (): Promise<string> => {
    if (typeof caches === 'undefined') return 'Cache API not available';
    
    try {
      const cacheNames = await caches.keys();
      return `Available (${cacheNames.length} caches)`;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  };

  const testServiceWorker = async (): Promise<string> => {
    if (!('serviceWorker' in navigator)) return 'Service Workers not supported';
    
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0 
        ? `Registered (${registrations.length})` 
        : 'Not registered';
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  };

  const runAllTests = async () => {
    setIsTesting(true);
    toast.loading("Running all network tests...");
    
    try {
      const results = await Promise.allSettled([
        testInternetConnection(),
        testServerConnection(),
        testCache(),
        testServiceWorker()
      ]);
      
      const newResults = {
        internet: results[0].status === 'fulfilled' ? results[0].value : 'Error',
        server: results[1].status === 'fulfilled' ? results[1].value : 'Error',
        cache: results[2].status === 'fulfilled' ? results[2].value : 'Error',
        serviceworker: results[3].status === 'fulfilled' ? results[3].value : 'Error'
      };
      
      setTestResults(newResults);
      toast.success("All tests completed");
    } catch (error) {
      toast.error("Tests failed", {
        description: error.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Network Diagnostics
        </CardTitle>
        <CardDescription>
          Test and diagnose network connectivity issues
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border ${hasInternet ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {hasInternet ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
              <span className="font-medium">Internet</span>
            </div>
            <div className={`text-sm ${hasInternet ? 'text-green-700' : 'text-red-700'}`}>
              {hasInternet ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className={`p-4 rounded-lg border ${hasServer ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Server className={`h-4 w-4 ${hasServer ? 'text-green-600' : 'text-red-600'}`} />
              <span className="font-medium">Server</span>
            </div>
            <div className={`text-sm ${hasServer ? 'text-green-700' : 'text-red-700'}`}>
              {hasServer ? 'Reachable' : 'Unreachable'}
            </div>
          </div>
          
          <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <CloudOff className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Queue</span>
            </div>
            <div className="text-sm text-blue-700">
              {pending} pending item{pending !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Test Results</h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={runAllTests}
                disabled={isTesting}
              >
                {isTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Run All Tests"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => checkConnection()}
              >
                Check Connection
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="font-medium">Internet Connection</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => runNetworkTest('internet')}
                  disabled={isTesting}
                >
                  Test
                </Button>
              </div>
              {testResults.internet !== undefined && (
                <div className="text-sm text-muted-foreground">
                  Result: {typeof testResults.internet === 'boolean' 
                    ? (testResults.internet ? '✅ Connected' : '❌ Disconnected')
                    : testResults.internet}
                </div>
              )}
            </div>
            
            <div className="space-y-2 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="font-medium">Server Health</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => runNetworkTest('server')}
                  disabled={isTesting}
                >
                  Test
                </Button>
              </div>
              {testResults.server !== undefined && (
                <div className="text-sm text-muted-foreground">
                  Result: {testResults.server}
                </div>
              )}
            </div>
            
            <div className="space-y-2 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="font-medium">Cache Status</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => runNetworkTest('cache')}
                  disabled={isTesting}
                >
                  Test
                </Button>
              </div>
              {testResults.cache !== undefined && (
                <div className="text-sm text-muted-foreground">
                  Result: {testResults.cache}
                </div>
              )}
            </div>
            
            <div className="space-y-2 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="font-medium">Service Worker</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => runNetworkTest('serviceworker')}
                  disabled={isTesting}
                >
                  Test
                </Button>
              </div>
              {testResults.serviceworker !== undefined && (
                <div className="text-sm text-muted-foreground">
                  Result: {testResults.serviceworker}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual Controls */}
        <div className="space-y-3">
          <h3 className="font-semibold">Manual Controls</h3>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline"
              onClick={() => syncOfflineData()}
              disabled={!isOnline || isSyncing || pending === 0}
            >
              {isSyncing ? "Syncing..." : "Force Sync Now"}
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                if (isOnline) {
                  toast.info("You're already online");
                } else {
                  toast.warning("Check network connection");
                }
              }}
            >
              Simulate Network Issues
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                localStorage.clear();
                toast.info("Local storage cleared");
              }}
            >
              Clear Local Data
            </Button>
          </div>
        </div>
        
        {/* Troubleshooting Tips */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-amber-800">Troubleshooting Tips</h4>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                <li>If "Internet" test fails, check your network connection</li>
                <li>If "Server" test fails, ensure the backend is running</li>
                <li>Pending items will sync automatically when back online</li>
                <li>Clear browser cache if Service Worker shows errors</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}