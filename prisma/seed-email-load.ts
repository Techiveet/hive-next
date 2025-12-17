// prisma/seed-email-load.ts

import * as Prisma from "@prisma/client";

import { faker } from "@faker-js/faker";

const prisma = new Prisma.PrismaClient();

const EMAIL_COUNT = 5000;
const BATCH_SIZE = 1000;
const BATCH_DELAY_MS = 100;

// --- User Emails from prisma/seed.ts ---
const CENTRAL_EMAIL = "jollyaemero2223@gmail.com";
const ACME_EMAIL = "acme.admin@hive.test";
const BETA_EMAIL = "beta.admin@hive.test";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

function banner(title: string) {
  const line = "─".repeat(title.length + 2);
  console.log(
    `\n${COLORS.cyan}┌${line}┐\n` +
      `│ ${COLORS.bold}${title}${COLORS.reset}${COLORS.cyan} │\n` +
      `└${line}┘${COLORS.reset}\n`
  );
}

function generateEmailAndRecipient(
  senderId: string,
  recipientId: string,
  index: number
) {
  const subject = faker.hacker.phrase() + ` (ID: ${index.toLocaleString()})`;
  const body = `<p>${faker.lorem.paragraphs(2, "<br/><br/>")}</p>`;
  const createdAt = faker.date.recent({ days: 365 });

  // 3% spam (receiver-side only)
  const isSpam = faker.datatype.boolean(0.03);

  const emailId = faker.string.uuid();

  const coreEmailData: Prisma.Prisma.EmailCreateManyInput = {
    id: emailId,
    subject,
    body,
    senderId,
    isE2EE: false,
    senderFolder: "sent",
    isStarred: faker.datatype.boolean(0.05),
    createdAt,
    updatedAt: createdAt,
  };

  const spamFlagsValue = isSpam
    ? (["seeded", "suspicious_keywords"] as unknown as Prisma.Prisma.InputJsonValue)
    : undefined; // ✅ IMPORTANT: use undefined, not null

  const recipientData: Prisma.Prisma.EmailRecipientCreateManyInput = {
    id: faker.string.uuid(),
    emailId,
    userId: recipientId,
    isRead: faker.datatype.boolean(0.8),
    isStarred: faker.datatype.boolean(0.1),
    folder: isSpam ? "spam" : "inbox",
    type: Prisma.RecipientType.TO,
    createdAt,

    // spam metadata only when spam
    previousFolder: isSpam ? "inbox" : undefined,
    spamReason: isSpam ? "Seeded spam simulation" : undefined,
    spamScore: isSpam ? faker.number.float({ min: 0.7, max: 1.0 }) : undefined,
    spamFlags: spamFlagsValue,
  };

  return { coreEmailData, recipientData };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedEmails() {
  banner(`Seeding ${EMAIL_COUNT.toLocaleString()} Emails for Performance Testing`);

  const [centralUser, acmeAdmin, betaAdmin] = await Promise.all([
    prisma.user.findUnique({
      where: { email: CENTRAL_EMAIL },
      select: { id: true, email: true },
    }),
    prisma.user.findUnique({
      where: { email: ACME_EMAIL },
      select: { id: true, email: true },
    }),
    prisma.user.findUnique({
      where: { email: BETA_EMAIL },
      select: { id: true, email: true },
    }),
  ]);

  if (!centralUser || !acmeAdmin || !betaAdmin) {
    console.error(`${COLORS.yellow}❌ One or more required users not found.`);
    console.error(`Required: ${CENTRAL_EMAIL}, ${ACME_EMAIL}, ${BETA_EMAIL}`);
    console.error(`Run prisma/seed.ts first.${COLORS.reset}`);
    return;
  }

  console.log(`Users identified:`);
  console.log(` - Central Admin: ${centralUser.email}`);
  console.log(` - Acme Admin: ${acmeAdmin.email}`);
  console.log(` - Beta Admin: ${betaAdmin.email}\n`);

  const paths = [
    { sender: centralUser, recipient: acmeAdmin },
    { sender: acmeAdmin, recipient: centralUser },
    { sender: centralUser, recipient: betaAdmin },
    { sender: betaAdmin, recipient: centralUser },
  ];

  const totalBatches = Math.ceil(EMAIL_COUNT / BATCH_SIZE);
  const startTime = Date.now();
  let successCount = 0;

  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batchEnd = Math.min((i + 1) * BATCH_SIZE, EMAIL_COUNT);
    const currentBatchSize = batchEnd - batchStart;

    try {
      const emailsToCreate: Prisma.Prisma.EmailCreateManyInput[] = [];
      const recipientsToCreate: Prisma.Prisma.EmailRecipientCreateManyInput[] = [];

      for (let j = 0; j < currentBatchSize; j++) {
        const globalIndex = batchStart + j;
        const path = paths[globalIndex % paths.length];

        const { coreEmailData, recipientData } = generateEmailAndRecipient(
          path.sender.id,
          path.recipient.id,
          globalIndex
        );

        emailsToCreate.push(coreEmailData);
        recipientsToCreate.push(recipientData);
      }

      const emailResult = await prisma.email.createMany({
        data: emailsToCreate,
        skipDuplicates: true,
      });

      await prisma.emailRecipient.createMany({
        data: recipientsToCreate,
        skipDuplicates: true,
      });

      successCount += emailResult.count;

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(
        `${COLORS.green}✔ Batch ${i + 1}/${totalBatches} done. Total emails: ${batchEnd.toLocaleString()} (${elapsed.toFixed(
          2
        )}s)${COLORS.reset}`
      );

      if (i < totalBatches - 1) await sleep(BATCH_DELAY_MS);
    } catch (error: any) {
      console.error(`${COLORS.yellow}⚠️ Error batch ${i + 1}: ${error.message}${COLORS.reset}`);
      await sleep(2000);
      continue;
    }
  }

  const finalTime = (Date.now() - startTime) / 1000;
  console.log(`\n${COLORS.bold}${COLORS.green}✅ Done!${COLORS.reset}`);
  console.log(
    `${COLORS.bold}${successCount.toLocaleString()} emails inserted in ${finalTime.toFixed(2)}s.${COLORS.reset}`
  );
}

process.on("SIGINT", async () => {
  console.log("\n\nReceived SIGINT. Disconnecting Prisma...");
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
