// lib/pgp-utils.ts
"use client";

import * as openpgp from 'openpgp';

// ====================================================================
// ENCRYPTION (RETAINS CLIENT-SIDE ENCRYPTION LOGIC)
// ====================================================================

/**
 * Encrypts a message using multiple recipient public keys.
 * @param plaintext The subject or body content.
 * @param publicKeys Array of recipient PGP public key blocks (ASC format).
 * @returns An object containing the armored (string) encrypted message.
 */
export async function pgpEncrypt(plaintext: string, publicKeys: string[]): Promise<string> {
    
    // Convert public key strings to OpenPGP key objects
    const encryptionKeys = await Promise.all(publicKeys.map(async key => {
        try {
            // Trim key to remove accidental whitespace/newlines before reading
            return await openpgp.readKey({ armoredKey: key.trim() });
        } catch (e) {
            console.error("Error reading public key for encryption:", e);
            return null;
        }
    })).then(keys => keys.filter(k => k !== null));

    if (encryptionKeys.length === 0) {
        throw new Error("No valid public keys found for encryption.");
    }

    // Perform encryption
    const armoredMessage = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: plaintext }),
        encryptionKeys: encryptionKeys,
    });

    return armoredMessage as string;
}

// ====================================================================
// DECRYPTION (REMOVED - MOVED TO SERVER ACTION)
// ====================================================================

// The pgpDecrypt function has been removed from this file.
// The new decryption logic will be implemented in a server action.