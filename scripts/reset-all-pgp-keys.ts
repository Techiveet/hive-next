// scripts/reset-all-pgp-keys.ts
// Run with: npx tsx scripts/reset-all-pgp-keys.ts

import * as openpgp from 'openpgp';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SERVER_KEY_PASS = process.env.PGP_VAULT_MASTER_KEY || 'YOUR_ULTRA_SECURE_SERVER_KEY_PASS';

async function resetAllKeys() {
    if (SERVER_KEY_PASS === 'YOUR_ULTRA_SECURE_SERVER_KEY_PASS') {
        console.error("❌ PGP_VAULT_MASTER_KEY not configured!");
        process.exit(1);
    }

    console.log("🔄 Starting bulk key reset...\n");

    // Get all users
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            pgpPublicKey: true,
            encryptedPrivateKey: true,
        },
    });

    console.log(`📊 Found ${users.length} users\n`);

    for (const user of users) {
        console.log(`\n🔧 Processing user: ${user.name} (${user.email})`);

        try {
            // Step 1: Clear old keys
            console.log("  🗑️  Clearing old keys...");
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    pgpPublicKey: null,
                    encryptedPrivateKey: null,
                },
            });

            // Step 2: Generate new keys
            console.log("  🔑 Generating new key pair...");
            const { privateKey, publicKey } = await openpgp.generateKey({
                userIDs: [{ name: user.name, email: user.email }],
                curve: 'ed25519',
                passphrase: SERVER_KEY_PASS,
            });

            // Step 3: Verify keys
            console.log("  🔍 Verifying key pair...");
            const pubKey = await openpgp.readKey({ armoredKey: publicKey });
            const privKey = await openpgp.readPrivateKey({ armoredKey: privateKey });
            const decryptedPrivKey = await openpgp.decryptKey({ 
                privateKey: privKey, 
                passphrase: SERVER_KEY_PASS 
            });

            const pubKeyID = pubKey.getKeyID().toHex();
            const privKeyID = decryptedPrivKey.getKeyID().toHex();

            if (pubKeyID !== privKeyID) {
                throw new Error("Key IDs don't match!");
            }

            console.log(`  ✅ Key IDs match: ${pubKeyID}`);

            // Step 4: Save new keys
            console.log("  💾 Saving to database...");
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    pgpPublicKey: publicKey,
                    encryptedPrivateKey: privateKey,
                },
            });

            console.log(`  ✅ User ${user.name} updated successfully`);

        } catch (error: any) {
            console.error(`  ❌ Failed for user ${user.name}:`, error.message);
        }
    }

    console.log("\n\n🎉 Bulk key reset complete!");
    console.log("📝 Next steps:");
    console.log("   1. Delete old encrypted emails: DELETE FROM Email WHERE isE2EE = true;");
    console.log("   2. Test by sending new encrypted emails");

    await prisma.$disconnect();
}

resetAllKeys().catch((e) => {
    console.error("Fatal error:", e);
    prisma.$disconnect();
    process.exit(1);
});