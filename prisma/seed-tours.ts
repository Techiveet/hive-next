// prisma/seed-tours.ts

import * as Prisma from "@prisma/client";

const prisma = new Prisma.PrismaClient();

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
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
 * EXPECTED UNIQUE:
 *   @@unique([tenantKey, key])
 *
 * MODELS:
 * - Tour: id, tenantId?, tenantKey, key, name, isActive, version
 * - TourStep: id, tourId, order, selector, title, body, placement, padding, rectX, rectY, rectWidth, rectHeight, onlyPathPrefix
 */

type StepInput = {
  order: number;
  selector: string;
  title: string;
  body: string;
  placement: string;
  padding?: number | null;
  rectX?: number | null;
  rectY?: number | null;
  rectWidth?: number | null;
  rectHeight?: number | null;
  onlyPathPrefix?: string | null;
};

type TourSeedInput = {
  tenantId: string | null;
  tenantKey: string; // "GLOBAL" or tenant.slug
  key: string; // tour key (ex: "dashboard")
  name: string;
  isActive: boolean;
  version: number;
  steps: StepInput[];
};

async function upsertTourWithSteps(input: TourSeedInput) {
  const tour = await prisma.tour.upsert({
    where: {
      tenantKey_key: {
        tenantKey: input.tenantKey,
        key: input.key,
      },
    },
    create: {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      key: input.key,
      name: input.name,
      isActive: input.isActive,
      version: input.version,
    },
    update: {
      name: input.name,
      isActive: input.isActive,
      version: input.version,
    },
    select: { id: true, tenantId: true, tenantKey: true, key: true },
  });

  // seed-safe: replace steps
  await prisma.tourStep.deleteMany({ where: { tourId: tour.id } });

  if (input.steps.length) {
    await prisma.tourStep.createMany({
      data: input.steps.map((s) => ({
        tourId: tour.id,
        order: s.order,
        selector: s.selector,
        title: s.title,
        body: s.body,
        placement: s.placement,
        padding: s.padding ?? null,
        rectX: s.rectX ?? null,
        rectY: s.rectY ?? null,
        rectWidth: s.rectWidth ?? null,
        rectHeight: s.rectHeight ?? null,
        onlyPathPrefix: s.onlyPathPrefix ?? null,
      })),
    });
  }

  return tour;
}

// keep selectors consistent
const sel = (key: string) => `[data-tour='${key}']`;
const path = (p: string) => p;

// 👇 rects from your paper (rounded to Int for Prisma schema)
const R = {
  sidebar: { x: 3, y: 1, w: 254, h: 744 },
  dashboard: { x: 4, y: 74, w: 244, h: 72 },
  tenants: { x: 4, y: 130, w: 244, h: 72 },
  security: { x: 4, y: 186, w: 244, h: 72 },
  files: { x: 4, y: 242, w: 244, h: 72 },
  billing: { x: 4, y: 298, w: 244, h: 72 },
  settings: { x: 4, y: 345, w: 244, h: 65 },
  content: { x: 256, y: 5, w: 1271, h: 568 },
} as const;

const rect = (x: number, y: number, w: number, h: number) => ({
  rectX: x,
  rectY: y,
  rectWidth: w,
  rectHeight: h,
});

async function seedTours() {
  banner("Seeding Tours (Standalone)");

  const tenantSlug = process.env.TOUR_TENANT_SLUG?.trim() || "";
  const globalOnly = process.env.TOUR_GLOBAL_ONLY === "1";

  let tenantId: string | null = null;
  let tenantKey = "GLOBAL";

  if (!globalOnly && tenantSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true },
    });

    if (!tenant) {
      console.log(
        `${COLORS.yellow}⚠️ Tenant slug not found: ${tenantSlug}. Will seed GLOBAL tours only.${COLORS.reset}`
      );
    } else {
      tenantId = tenant.id;
      tenantKey = tenant.slug;
      console.log(
        `${COLORS.green}✔ Target tenant: ${tenant.slug}${COLORS.reset}`
      );
    }
  } else {
    console.log(`${COLORS.green}✔ Target: GLOBAL tours only${COLORS.reset}`);
  }

  // ---------------------------------------------------------------------------
  // GLOBAL TOURS (used by your Settings “Tour Manager”)
  // ---------------------------------------------------------------------------
  const globalTours: TourSeedInput[] = [
    {
      tenantId: null,
      tenantKey: "GLOBAL",
      key: "dashboard",
      name: "Dashboard Tour",
      isActive: true,
      version: 3, // ✅ bump again
      steps: [
        {
          order: 0,
          selector: sel("sidebar"),
          title: "Sidebar",
          body: "This is your main navigation panel.",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/dashboard"),
          ...rect(R.sidebar.x, R.sidebar.y, R.sidebar.w, R.sidebar.h),
        },
        {
          order: 1,
          selector: sel("nav-dashboard"),
          title: "Dashboard",
          body: "Go back to the dashboard anytime.",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/dashboard"),
          ...rect(R.dashboard.x, R.dashboard.y, R.dashboard.w, R.dashboard.h),
        },
        {
          order: 2,
          selector: sel("nav-tenants"),
          title: "Tenants",
          body: "Manage tenants and workspace access.",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/dashboard"),
          ...rect(R.tenants.x, R.tenants.y, R.tenants.w, R.tenants.h),
        },
        {
          order: 3,
          selector: sel("nav-security"),
          title: "Security",
          body: "Roles, permissions, and security controls.",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/dashboard"),
          ...rect(R.security.x, R.security.y, R.security.w, R.security.h),
        },
        {
          order: 4,
          selector: sel("nav-files"),
          title: "Files",
          body: "Upload and manage files in your workspace.",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/dashboard"),
          ...rect(R.files.x, R.files.y, R.files.w, R.files.h),
        },
        {
          order: 5,
          selector: sel("nav-billing"),
          title: "Billing",
          body: "Subscription and billing information.",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/dashboard"),
          ...rect(R.billing.x, R.billing.y, R.billing.w, R.billing.h),
        },

        // ✅ Settings is the last sidebar link → show it, but don't navigate
        {
          order: 6,
          selector: sel("nav-settings"),
          title: "Settings",
          body: "Your app configuration lives here (profile, security, branding, etc.).",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/dashboard"),
          ...rect(R.settings.x, R.settings.y, R.settings.w, R.settings.h),
        },

        // ✅ FINAL: content
        {
          order: 7,
          selector: sel("content"), // -> [data-tour="content"]
          title: "Main Workspace",
          body: "This area updates based on what you open from the sidebar.",
          placement: "bottom",
          padding: 10,
          onlyPathPrefix: path("/dashboard"),
          ...rect(R.content.x, R.content.y, R.content.w, R.content.h),
        },
      ],
    },

    {
      tenantId: null,
      tenantKey: "GLOBAL",
      key: "settings",
      name: "Settings Tour",
      isActive: true,
      version: 1,
      steps: [
        {
          order: 0,
          selector: sel("nav-settings"),
          title: "Open Settings",
          body: "Use the sidebar to open Settings.",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/settings"),
          ...rect(R.settings.x, R.settings.y, R.settings.w, R.settings.h),
        },
        {
          order: 1,
          selector: sel("settings-left-nav"),
          title: "Settings Sections",
          body: "Pick a section from the left navigation.",
          placement: "right",
          padding: 10,
          onlyPathPrefix: path("/settings"),
        },
        {
          order: 2,
          selector: sel("settings-save"),
          title: "Save",
          body: "Save your changes after editing.",
          placement: "top",
          padding: 10,
          onlyPathPrefix: path("/settings"),
        },
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // TENANT OVERRIDES (optional)
  // ---------------------------------------------------------------------------
// Tenant-specific tours
  const tenantTours: TourSeedInput[] = tenantId
    ? [
        {
          tenantId,
          tenantKey,
          key: "dashboard",
          name: "Dashboard Tour (Tenant Override)",
          isActive: true,
          version: 1,
          steps: [
            {
              order: 0,
              selector: sel("sidebar"),
              title: "Sidebar (Tenant)",
              body: "Tenant-specific sidebar intro.",
              placement: "right",
              padding: 10,
              onlyPathPrefix: path("/dashboard"),
              ...rect(R.sidebar.x, R.sidebar.y, R.sidebar.w, R.sidebar.h),
            },
            // Add more steps here for tenant-specific tour
          ],
        },
      ]
    : [];

 

  const toursToSeed = [...globalTours, ...tenantTours];

  for (const t of toursToSeed) {
    const tour = await upsertTourWithSteps(t);
    console.log(
      `${COLORS.green}✔ Upserted tour:${COLORS.reset} ${COLORS.bold}${tour.key}${COLORS.reset} ` +
        `(tenantKey: ${tour.tenantKey}, tenantId: ${tour.tenantId ?? "NULL"})`
    );
  }

  console.log(
    `\n${COLORS.bold}${COLORS.green}✅ Done seeding tours.${COLORS.reset}`
  );
}

process.on("SIGINT", async () => {
  console.log("\n\nReceived SIGINT. Disconnecting Prisma...");
  await prisma.$disconnect();
  process.exit(0);
});

seedTours()
  .catch((e: any) => {
    console.error(`${COLORS.red}Tour seed failed:${COLORS.reset}`, e?.message);
    console.error("Stack trace:", e?.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
