// app/(dashboard)/settings/pgp-diagnostics/page.tsx
"use client";

import {
    clearUserKeysAction,
    generateAndSaveKeyAction,
    verifyUserKeysAction
} from "../../email/encryption-actions";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Import the diagnostic actions
// You'll need to export these from your encryption-actions file


type KeyStatus = {
    valid: boolean;
    message: string;
    publicKeyID?: string;
    privateKeyID?: string;
    keysMatch?: boolean;
    hasPublicKey?: boolean;
    hasPrivateKey?: boolean;
    error?: string;
};

export default function PGPDiagnosticsPage() {
    const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Get current user info (you'll need to fetch this)
    const [userInfo, setUserInfo] = useState<any>(null);

    useEffect(() => {
        // Fetch current user info
        fetch('/api/user/me') // Adjust this endpoint to match your API
            .then(res => res.json())
            .then(data => setUserInfo(data))
            .catch(err => console.error("Failed to fetch user info:", err));
    }, []);

    const checkKeys = async () => {
        setLoading(true);
        try {
            const result = await verifyUserKeysAction();
            setKeyStatus(result);
            
            if (result.valid) {
                toast.success("Keys are valid! ✅");
            } else {
                toast.error("Key issue detected! ❌");
            }
        } catch (e: any) {
            toast.error(`Error checking keys: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const clearKeys = async () => {
        if (!userInfo?.id) {
            toast.error("User info not loaded");
            return;
        }

        if (!confirm("Are you sure you want to clear your keys? This will disable E2EE until you generate new keys.")) {
            return;
        }

        setLoading(true);
        try {
            await clearUserKeysAction(userInfo.id);
            toast.success("Keys cleared successfully");
            setKeyStatus(null);
            
            // Re-check status
            setTimeout(() => checkKeys(), 500);
        } catch (e: any) {
            toast.error(`Error clearing keys: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const regenerateKeys = async () => {
        if (!userInfo?.id || !userInfo?.name || !userInfo?.email) {
            toast.error("User info not loaded");
            return;
        }

        if (!confirm("Generate new keys? This will replace any existing keys.")) {
            return;
        }

        setLoading(true);
        try {
            await generateAndSaveKeyAction({
                userId: userInfo.id,
                userName: userInfo.name,
                userEmail: userInfo.email,
            });
            toast.success("New keys generated successfully!");
            
            // Re-check status
            setTimeout(() => checkKeys(), 500);
        } catch (e: any) {
            toast.error(`Error generating keys: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="border rounded-lg p-6 bg-white dark:bg-slate-900">
                <h1 className="text-2xl font-bold mb-4">PGP Key Diagnostics</h1>
                
                <div className="space-y-4">
                    <Button 
                        onClick={checkKeys} 
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? "Checking..." : "Check Key Status"}
                    </Button>

                    {keyStatus && (
                        <div className={`p-4 rounded-lg border ${
                            keyStatus.valid 
                                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800" 
                                : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                        }`}>
                            <h3 className={`font-semibold mb-2 ${
                                keyStatus.valid ? "text-emerald-900 dark:text-emerald-100" : "text-red-900 dark:text-red-100"
                            }`}>
                                {keyStatus.valid ? "✅ Keys Valid" : "❌ Key Issues Detected"}
                            </h3>
                            
                            <div className="space-y-2 text-sm">
                                <p><strong>Status:</strong> {keyStatus.message}</p>
                                
                                {keyStatus.hasPublicKey !== undefined && (
                                    <p><strong>Has Public Key:</strong> {keyStatus.hasPublicKey ? "✅ Yes" : "❌ No"}</p>
                                )}
                                
                                {keyStatus.hasPrivateKey !== undefined && (
                                    <p><strong>Has Private Key:</strong> {keyStatus.hasPrivateKey ? "✅ Yes" : "❌ No"}</p>
                                )}
                                
                                {keyStatus.publicKeyID && (
                                    <p><strong>Public Key ID:</strong> <code className="text-xs">{keyStatus.publicKeyID}</code></p>
                                )}
                                
                                {keyStatus.privateKeyID && (
                                    <p><strong>Private Key ID:</strong> <code className="text-xs">{keyStatus.privateKeyID}</code></p>
                                )}
                                
                                {keyStatus.keysMatch !== undefined && (
                                    <p><strong>Keys Match:</strong> {keyStatus.keysMatch ? "✅ Yes" : "❌ No"}</p>
                                )}
                                
                                {keyStatus.error && (
                                    <p className="text-red-600 dark:text-red-400"><strong>Error:</strong> {keyStatus.error}</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="border-t pt-4 space-y-3">
                        <h3 className="font-semibold">Key Management Actions</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Button 
                                onClick={clearKeys}
                                variant="outline"
                                disabled={loading || !keyStatus || (!keyStatus.hasPublicKey && !keyStatus.hasPrivateKey)}
                            >
                                🗑️ Clear Existing Keys
                            </Button>
                            
                            <Button 
                                onClick={regenerateKeys}
                                variant="default"
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                🔄 Generate New Keys
                            </Button>
                        </div>
                        
                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                            <p>⚠️ <strong>Important:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Clearing keys will disable E2EE until new keys are generated</li>
                                <li>Old encrypted emails cannot be decrypted with new keys</li>
                                <li>All recipients must have the latest keys to send/receive encrypted emails</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="font-semibold mb-2">Troubleshooting Steps</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <li>Click "Check Key Status" to diagnose the issue</li>
                            <li>If keys don't match or are missing, click "Clear Existing Keys"</li>
                            <li>Click "Generate New Keys" to create a fresh key pair</li>
                            <li>Test by sending a new encrypted email</li>
                            <li>If you still have issues, check the console logs for detailed errors</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
}