// prisma/seed-email-load.ts

import * as Prisma from "@prisma/client";

import { faker } from "@faker-js/faker";

const prisma = new Prisma.PrismaClient();
// const EMAIL_COUNT = 1_000_000;
const EMAIL_COUNT = 5000;
const BATCH_SIZE = 1000; // Reduced from 5000 to 500
const BATCH_DELAY_MS = 100; // Delay between batches in milliseconds

// --- User Emails from prisma/seed.ts ---
const CENTRAL_EMAIL = "jollyaemero2223@gmail.com";
const ACME_EMAIL = "acme.admin@hive.test";
const BETA_EMAIL = "beta.admin@hive.test";

// simple ANSI colors for nicer terminal output
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

function banner(title: string) {
  const line = "─".repeat(title.length + 2);
  console.log(
    `\n${COLORS.cyan}┌${line}┐\n` +
      `│ ${COLORS.bold}${title}${COLORS.reset}${COLORS.cyan} │\n` +
      `└${line}┘${COLORS.reset}\n`
  );
}

/**
 * Generates a standard (non-E2EE) email payload for insertion.
 */
function generateEmailData(senderId: string, recipientId: string, index: number) {
  const subject = faker.hacker.phrase() + ` (ID: ${index.toLocaleString()})`;
  const body = `<p>${faker.lorem.paragraphs(2, "<br/><br/>")}</p>`;
  
  const createdAt = faker.date.recent({ days: 365 });

  const coreEmailData = {
    subject,
    body,
    senderId,
    isE2EE: false, 
    senderFolder: "sent",
    createdAt,
    updatedAt: createdAt,
  };

  const recipientData = {
    userId: recipientId,
    isRead: faker.datatype.boolean(0.8), 
    isStarred: faker.datatype.boolean(0.1), 
    folder: "inbox",
    type: Prisma.RecipientType.TO,
    createdAt,
  };
  
  return { coreEmailData, recipientData };
}

/**
 * Sleep function to add delay between batches
 */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function to seed a large volume of emails.
 */
async function seedEmails() {
  banner(`Seeding ${EMAIL_COUNT.toLocaleString()} Emails for Performance Testing`);

  // --- 1. Identify Users from the Main Seed ---
  const users = await Promise.all([
    prisma.user.findUnique({ where: { email: CENTRAL_EMAIL }, select: { id: true, email: true } }),
    prisma.user.findUnique({ where: { email: ACME_EMAIL }, select: { id: true, email: true } }),
    prisma.user.findUnique({ where: { email: BETA_EMAIL }, select: { id: true, email: true } }),
  ]);

  const centralUser = users[0];
  const acmeAdmin = users[1];
  const betaAdmin = users[2];

  if (!centralUser || !acmeAdmin || !betaAdmin) {
    console.error(`${COLORS.yellow}❌ One or more required users (Central, Acme, Beta) not found.`);
    console.error(`Emails required: ${CENTRAL_EMAIL}, ${ACME_EMAIL}, ${BETA_EMAIL}`);
    console.error(`Please run the main seed file (prisma/seed.ts) first, then try again.${COLORS.reset}`);
    return;
  }

  console.log(`Users identified:`);
  console.log(` - Central Admin: ${centralUser.email}`);
  console.log(` - Acme Admin: ${acmeAdmin.email}`);
  console.log(` - Beta Admin: ${betaAdmin.email}`);
  console.log(`\nSeeding messages to test cross-tenant and Central Admin flows.`);
  
  // Define communication paths (alternating between them for variety)
  const paths = [
    { sender: centralUser, recipient: acmeAdmin, description: "Central -> Acme (Valid)" },
    { sender: acmeAdmin, recipient: centralUser, description: "Acme -> Central (Valid)" },
    { sender: centralUser, recipient: betaAdmin, description: "Central -> Beta (Valid)" },
    { sender: betaAdmin, recipient: centralUser, description: "Beta -> Central (Valid)" },
  ];

  // --- 2. Start Batched Insertion ---
  const totalBatches = Math.ceil(EMAIL_COUNT / BATCH_SIZE);
  const startTime = Date.now();
  let successCount = 0;

  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batchEnd = Math.min((i + 1) * BATCH_SIZE, EMAIL_COUNT);
    const currentBatchSize = batchEnd - batchStart;

    try {
      const createPromises = [];
      for (let j = 0; j < currentBatchSize; j++) {
        const globalIndex = batchStart + j;
        
        // Cycle through the 4 defined communication paths
        const path = paths[globalIndex % paths.length];
        
        const { coreEmailData, recipientData } = generateEmailData(path.sender.id, path.recipient.id, globalIndex);

        // Use prisma.email.create with nested write for efficiency
        createPromises.push(
          prisma.email.create({
            data: {
              ...coreEmailData,
              recipients: {
                create: recipientData,
              },
            },
            select: { id: true } 
          })
        );
      }

      // Wait for the batch to resolve
      const results = await Promise.all(createPromises);
      successCount += results.length;

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(
        `${COLORS.green}  ✔ Batch ${i + 1}/${totalBatches} complete. Total: ${batchEnd.toLocaleString()} emails. (${elapsed.toFixed(2)}s)${COLORS.reset}`
      );

      // Add delay between batches to allow connection pool to recover
      if (i < totalBatches - 1) {
        await sleep(BATCH_DELAY_MS);
      }

    } catch (error: any) {
      console.error(`${COLORS.yellow}⚠️ Error in batch ${i + 1}: ${error.message}${COLORS.reset}`);
      console.log(`${COLORS.yellow}Continuing with next batch...${COLORS.reset}`);
      
      // Sleep longer on error to let database recover
      await sleep(2000);
      continue;
    }
  }

  const finalTime = (Date.now() - startTime) / 1000;

  console.log("\n" + "=".repeat(60));
  console.log(`${COLORS.bold}${COLORS.green}✅ Massive Email Load Seed Complete!${COLORS.reset}`);
  console.log(`${COLORS.bold}${successCount.toLocaleString()} emails inserted in ${finalTime.toFixed(2)} seconds.${COLORS.reset}`);
  console.log(`${COLORS.bold}Average rate: ${(successCount / finalTime).toFixed(2)} emails/second${COLORS.reset}`);
  console.log(`Testing traffic generated: Central <-> Acme, Central <-> Beta.`);
  console.log("=".repeat(60));
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT. Disconnecting Prisma...');
  await prisma.$disconnect();
  process.exit(0);
});

seedEmails()
  .catch((e) => {
    console.error("Email Load Seed failed:", e.message);
    console.error("Stack trace:", e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });