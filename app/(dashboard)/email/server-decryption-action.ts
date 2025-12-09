// app/(dashboard)/email/server-decryption-action.ts
"use server";

import * as openpgp from 'openpgp';

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const SERVER_KEY_PASS = process.env.PGP_VAULT_MASTER_KEY || 'YOUR_ULTRA_SECURE_SERVER_KEY_PASS'; 

// ====================================================================
// AUTOMATIC DECRYPTION WITH DIAGNOSTICS
// ====================================================================

export async function autoDecryptAction(encryptedText: string) {
    
    if (SERVER_KEY_PASS === 'YOUR_ULTRA_SECURE_SERVER_KEY_PASS') {
        throw new Error("PGP Master Key is not configured on the server.");
    }

    const { user } = await getCurrentSession();
    if (!user) throw new Error("Unauthorized");

    console.log("🔍 Decryption Debug - User ID:", user.id);

    // 1. Fetch the user's encrypted private key
    const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { 
            encryptedPrivateKey: true,
            pgpPublicKey: true 
        },
    });
    
    const encryptedPrivateKey = userData?.encryptedPrivateKey;
    if (!encryptedPrivateKey) {
        throw new Error("User does not have a private key stored for automatic decryption.");
    }

    console.log("✅ Private key found in database");
    console.log("📝 Encrypted text length:", encryptedText.length);
    console.log("📝 First 50 chars of encrypted text:", encryptedText.substring(0, 50));

    // 2. Decode the Base64-encoded PGP message
    let armoredMessage: string;
    try {
        armoredMessage = atob(encryptedText.trim());
        console.log("✅ Base64 decoded successfully");
        console.log("📝 Armored message length:", armoredMessage.length);
        console.log("📝 Message starts with:", armoredMessage.substring(0, 100));
    } catch (e) {
        console.error("❌ Failed to decode Base64");
        throw new Error("Invalid encrypted message format. Message may be corrupted.");
    }

    try {
        // 3. Read and Decrypt the Private Key
        console.log("🔑 Reading private key...");
        const privateKey = await openpgp.readPrivateKey({ armoredKey: encryptedPrivateKey });
        console.log("✅ Private key read successfully");
        console.log("🔑 Key ID:", privateKey.getKeyID().toHex());
        
        console.log("🔓 Decrypting private key with master passphrase...");
        const decryptedPrivateKey = await openpgp.decryptKey({ 
            privateKey, 
            passphrase: SERVER_KEY_PASS 
        });
        console.log("✅ Private key decrypted successfully");

        // 4. Read the encrypted message and check which keys it was encrypted for
        console.log("📧 Reading encrypted message...");
        const message = await openpgp.readMessage({ armoredMessage });
        console.log("✅ Message read successfully");
        
        // Get the key IDs this message was encrypted for
        const encryptionKeyIDs = message.getEncryptionKeyIDs();
        console.log("🔑 Message encrypted for key IDs:", 
            encryptionKeyIDs.map(id => id.toHex()).join(", ")
        );
        console.log("🔑 Our decryption key ID:", decryptedPrivateKey.getKeyID().toHex());
        
        // Check if our key matches
        const keyMatch = encryptionKeyIDs.some(id => 
            id.toHex() === decryptedPrivateKey.getKeyID().toHex()
        );
        console.log("🔍 Key match status:", keyMatch ? "✅ MATCH" : "❌ NO MATCH");

        // 5. Attempt decryption
        console.log("🔓 Attempting to decrypt message...");
        const { data: decryptedText } = await openpgp.decrypt({
            message,
            decryptionKeys: [decryptedPrivateKey],
        });

        console.log("✅ Decryption successful!");
        return decryptedText as string; 

    } catch (e: any) {
        console.error("❌ Auto-Decryption failed for user:", user.id);
        console.error("❌ Error:", e.message);
        console.error("❌ Stack:", e.stack);
        throw new Error(`Decryption failed: ${e.message}`);
    }
}

// ====================================================================
// UTILITY: Clear and regenerate user keys
// ====================================================================

/**
 * Clears a user's existing keys. Use this if keys are mismatched.
 * Call this via a server action or admin panel.
 */
export async function clearUserKeysAction(userId: string) {
    const { user } = await getCurrentSession();
    if (!user) throw new Error("Unauthorized");
    
    // Only allow users to clear their own keys, or add admin check here
    if (user.id !== userId) {
        throw new Error("Cannot clear another user's keys");
    }
    
    await prisma.user.update({
        where: { id: userId },
        data: {
            pgpPublicKey: null,
            encryptedPrivateKey: null,
        },
    });
    
    console.log("🗑️ Cleared keys for user:", userId);
    return { success: true };
}

// ====================================================================
// UTILITY: Verify key pair integrity
// ====================================================================

/**
 * Verifies that a user's stored key pair is valid and matches.
 * Returns diagnostic information.
 */
export async function verifyUserKeysAction() {
    const { user } = await getCurrentSession();
    if (!user) throw new Error("Unauthorized");

    const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { 
            encryptedPrivateKey: true,
            pgpPublicKey: true 
        },
    });

    if (!userData?.pgpPublicKey || !userData?.encryptedPrivateKey) {
        return {
            valid: false,
            message: "No keys found for this user",
            hasPublicKey: !!userData?.pgpPublicKey,
            hasPrivateKey: !!userData?.encryptedPrivateKey,
        };
    }

    try {
        // Read both keys
        const publicKey = await openpgp.readKey({ armoredKey: userData.pgpPublicKey });
        const privateKey = await openpgp.readPrivateKey({ armoredKey: userData.encryptedPrivateKey });
        
        // Decrypt private key
        const decryptedPrivateKey = await openpgp.decryptKey({ 
            privateKey, 
            passphrase: SERVER_KEY_PASS 
        });

        // Check if key IDs match
        const publicKeyID = publicKey.getKeyID().toHex();
        const privateKeyID = decryptedPrivateKey.getKeyID().toHex();
        const keysMatch = publicKeyID === privateKeyID;

        return {
            valid: keysMatch,
            message: keysMatch ? "Keys are valid and match" : "Key pair mismatch!",
            publicKeyID,
            privateKeyID,
            keysMatch,
        };

    } catch (e: any) {
        return {
            valid: false,
            message: `Error verifying keys: ${e.message}`,
            error: e.message,
        };
    }
}