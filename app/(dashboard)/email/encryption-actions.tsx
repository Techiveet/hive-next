// app/(dashboard)/email/encryption-actions.ts
"use server";

import * as openpgp from 'openpgp';

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const SERVER_KEY_PASS = process.env.PGP_VAULT_MASTER_KEY || 'YOUR_ULTRA_SECURE_SERVER_KEY_PASS'; 

// ====================================================================
// SERVER-SIDE PGP KEY MANAGEMENT ACTIONS
// ====================================================================

/**
 * Generates a key pair for the user, encrypts the private key using a server secret,
 * and saves both keys to the database. This enables automatic E2EE.
 */
export async function generateAndSaveKeyAction({ 
    userId, 
    userName, 
    userEmail 
}: { 
    userId: string; 
    userName: string; 
    userEmail: string;
}) {
    
    if (SERVER_KEY_PASS === 'YOUR_ULTRA_SECURE_SERVER_KEY_PASS') {
        throw new Error("SERVER_KEY_PASS is not configured. Cannot secure keys.");
    }

    console.log("🔑 Generating new key pair for user:", userId);

    // 1. Generate the PGP Key Pair
    const { privateKey: privateKeyArmored, publicKey: publicKeyArmored } = await openpgp.generateKey({
        userIDs: [{ name: userName || userId, email: userEmail }],
        curve: 'ed25519', // Modern and secure curve
        passphrase: SERVER_KEY_PASS, // Use the server secret to encrypt the private key
    });
    
    console.log("✅ Key pair generated");
    
    // 2. Verify the keys work before saving
    try {
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
        const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
        const decryptedPrivateKey = await openpgp.decryptKey({ 
            privateKey, 
            passphrase: SERVER_KEY_PASS 
        });
        
        const publicKeyID = publicKey.getKeyID().toHex();
        const privateKeyID = decryptedPrivateKey.getKeyID().toHex();
        
        console.log("🔍 Public Key ID:", publicKeyID);
        console.log("🔍 Private Key ID:", privateKeyID);
        
        if (publicKeyID !== privateKeyID) {
            throw new Error("Generated key pair IDs don't match!");
        }
        
        console.log("✅ Key pair verified");
    } catch (e: any) {
        console.error("❌ Key verification failed:", e.message);
        throw new Error(`Key generation failed: ${e.message}`);
    }
    
    // 3. Save both keys to the database
    await prisma.user.update({
        where: { id: userId },
        data: { 
            pgpPublicKey: publicKeyArmored,
            encryptedPrivateKey: privateKeyArmored,
        },
    });

    console.log("✅ Keys saved to database");

    revalidatePath("/settings"); 
    revalidatePath("/email");

    return { success: true }; 
}

/**
 * Fetches the PGP public key for the currently logged-in user (the sender).
 * This is the FIX to allow senders to decrypt their own messages.
 */
export async function getSenderPublicKeyAction() {
    const { user } = await getCurrentSession();
    if (!user) return { publicKey: null };

    const senderKeys = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            pgpPublicKey: true,
            encryptedPrivateKey: true, // Checking integrity
        },
    });

    if (!senderKeys?.pgpPublicKey || !senderKeys?.encryptedPrivateKey) {
        return { publicKey: null };
    }

    return { publicKey: senderKeys.pgpPublicKey };
}


/**
 * Fetches the PGP public key for a list of user IDs.
 * Used by the Compose Dialog to determine encryption eligibility.
 */
export async function getPublicKeysAction(userIds: string[]) {
    const { user } = await getCurrentSession();
    if (!user) throw new Error("Unauthorized");

    const usersWithKeys = await prisma.user.findMany({
        where: {
            id: { in: userIds },
            pgpPublicKey: { not: null },
            encryptedPrivateKey: { not: null } 
        },
        select: {
            id: true,
            pgpPublicKey: true,
        },
    });

    return usersWithKeys;
}

/**
 * Allows a user to remove their stored PGP keys, effectively disabling E2EE.
 */
export async function revokePublicKeyAction() {
    const { user } = await getCurrentSession();
    if (!user) throw new Error("Unauthorized");

    await prisma.user.update({
        where: { id: user.id },
        data: { 
            pgpPublicKey: null,
            encryptedPrivateKey: null,
        }, 
    });
    
    revalidatePath("/settings"); 
    revalidatePath("/email");
    
    return { success: true };
}

// ====================================================================
// DIAGNOSTIC UTILITIES
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

/**
 * Clears a user's existing keys. Use this if keys are mismatched.
 */
export async function clearUserKeysAction(userId: string) {
    const { user } = await getCurrentSession();
    if (!user) throw new Error("Unauthorized");
    
    // Only allow users to clear their own keys
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
    
    revalidatePath("/settings"); 
    revalidatePath("/email");
    
    return { success: true };
}