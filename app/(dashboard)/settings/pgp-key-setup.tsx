// app/(dashboard)/settings/pgp-key-setup.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { generateAndSaveKeyAction, revokePublicKeyAction } from '../email/encryption-actions';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';

// You'll need to pass the current user's info to this component
interface PGPKeySetupProps {
    userId: string;
    userName: string;
    userEmail: string;
    hasKey: boolean; 
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ------------------------------------------------------------------
// PGP Key Management UI
// ------------------------------------------------------------------

export default function PGPKeySetup({ userId, userName, userEmail, hasKey }: PGPKeySetupProps) {
    const [confirmationText, setConfirmationText] = useState(''); 
    const [isGenerating, startGenerateTransition] = useTransition();
    const [isRevoking, startRevokeTransition] = useTransition(); 
    
    const isBusy = isGenerating || isRevoking; // Centralized busy state

    // --- GENERATE HANDLER ---
    const handleGenerateClick = async () => {
        if (isBusy || hasKey) return;
        
        if (confirmationText.toLowerCase() !== 'confirm') { 
            return toast.error("Please type 'confirm' to proceed with automatic key generation.");
        }
        
        const toastId = toast.loading("🔑 Generating PGP Key Pair on server. This may take a moment...", { duration: 5000 });

        startGenerateTransition(async () => {
            try {
                await generateAndSaveKeyAction({ userId, userName, userEmail });
                
                // Show success message first
                toast.success("✅ Key pair generated and stored securely on the server!", { id: toastId, duration: 3000 });
                
                // Add small delay before reloading to allow toast to render
                await delay(500); 
                window.location.reload(); 

            } catch (e: any) {
                console.error("Key Generation Failed:", e);
                // Ensure toast is updated to error state
                toast.error(`❌ Failed to generate or save key: ${e.message}`, { id: toastId });
            }
        });
    };
    
    // --- REVOCATION HANDLER ---
    const handleRevokeClick = () => {
        if (!hasKey || isBusy) return;
        
        const confirmRevoke = window.confirm("Are you sure you want to disable encryption? This will remove your keys from the server.");
        
        if (!confirmRevoke) return;

        startRevokeTransition(async () => {
            const toastId = toast.loading("🗑️ Disabling encryption...");
            try {
                await revokePublicKeyAction();
                
                // Show success message first
                toast.success("✅ Encryption successfully disabled. Keys removed.", { id: toastId, duration: 3000 });
                
                // Add small delay before reloading to allow toast to render
                await delay(500); 
                window.location.reload(); 
            } catch (e) {
                console.error("Revocation failed:", e);
                toast.error("❌ Failed to disable encryption.", { id: toastId });
            }
        });
    };
    // ----------------------------

    return (
        <div className="space-y-4 p-6 border rounded-lg">
            <h3 className="text-lg font-semibold">Automatic End-to-End Encryption Setup</h3>
            
            {hasKey ? (
                <p className="text-emerald-600">Your PGP keys are active and managed securely by the server. E2EE is automatic.</p>
            ) : (
                <p className="text-yellow-600">Your account does not have E2EE keys. Generate them now to enable seamless, automatic E2EE.</p>
            )}

            {!hasKey && (
                <div className="space-y-2">
                    <label className="text-sm font-medium block">Type 'confirm' to Generate Keys</label>
                    <Input
                        type="text"
                        value={confirmationText}
                        onChange={(e) => setConfirmationText(e.target.value)}
                        placeholder="Type 'confirm'"
                        disabled={isBusy} // Use centralized busy state
                    />
                    <p className="text-xs text-muted-foreground">This action generates and securely stores your keys on the server for automatic decryption.</p>
                    
                    <Button 
                        onClick={handleGenerateClick} 
                        // Disabled if busy OR confirmation text is incorrect
                        disabled={isBusy || confirmationText.toLowerCase() !== 'confirm'} 
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                        {isGenerating ? "Generating..." : "Generate & Enable Automatic E2EE"}
                    </Button>
                </div>
            )}
            
            {hasKey && (
                <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleRevokeClick}
                    disabled={isBusy} // Use centralized busy state
                    className="w-full"
                >
                    {isRevoking ? "Revoking..." : "Revoke Existing Keys (Disable Encryption)"}
                </Button>
            )}
        </div>
    );
}