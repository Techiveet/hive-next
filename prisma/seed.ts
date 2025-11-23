// prisma/seed.ts

import { PrismaClient, RoleScope } from "@prisma/client";

import { auth } from "../lib/auth";

const prisma = new PrismaClient();

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

function section(title: string) {
  console.log(`\n${COLORS.magenta}${COLORS.bold}› ${title}${COLORS.reset}`);
}

async function ensureUser(opts: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: opts.email },
  });

  if (existing) return existing;

  await auth.api.signUpEmail({
    body: {
      name: opts.name,
      email: opts.email,
      password: opts.password,
    },
  });

  const created = await prisma.user.findUnique({
    where: { email: opts.email },
  });

  if (!created) {
    throw new Error(`Failed to create user ${opts.email}`);
  }

  return created;
}

async function main() {
  banner("Hive Seed – Roles, Permissions, Tenants & Superadmins");

  //
  // 1) PERMISSIONS
  //
  section("Seeding permissions");

  const permissionsData = [
    { key: "manage_tenants", name: "Manage Tenants" },
    { key: "manage_users", name: "Manage Users" },
    { key: "manage_roles", name: "Manage Roles & Permissions" },
    { key: "manage_billing", name: "Manage Billing & Subscriptions" },
    { key: "view_audit_logs", name: "View Audit Logs" },
  ];

  const permissions = await Promise.all(
    permissionsData.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: {},
        create: p,
      })
    )
  );

  console.log(
    `${COLORS.green}  ✔ ${permissions.length} permissions seeded${COLORS.reset}`
  );

  //
  // 2) ROLES
  //
  section("Seeding roles");

  const centralSuperAdmin = await prisma.role.upsert({
    where: { key: "central_superadmin" },
    update: {},
    create: {
      key: "central_superadmin",
      name: "Central Super Administrator",
      scope: RoleScope.CENTRAL,
    },
  });

  const tenantSuperAdmin = await prisma.role.upsert({
    where: { key: "tenant_superadmin" },
    update: {},
    create: {
      key: "tenant_superadmin",
      name: "Tenant Super Administrator",
      scope: RoleScope.TENANT,
    },
  });

  await prisma.rolePermission.deleteMany({
    where: {
      OR: [
        { roleId: centralSuperAdmin.id },
        { roleId: tenantSuperAdmin.id },
      ],
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.flatMap((perm) => [
      {
        roleId: centralSuperAdmin.id,
        permissionId: perm.id,
      },
      {
        roleId: tenantSuperAdmin.id,
        permissionId: perm.id,
      },
    ]),
    skipDuplicates: true,
  });

  console.log(
    `${COLORS.green}  ✔ central_superadmin & tenant_superadmin roles seeded with all permissions${COLORS.reset}`
  );

  //
  // 3) TENANTS (without domains)
  //
  section("Seeding tenants");

  const tenantsData = [
    { slug: "central-hive", name: "Central Hive" },
    { slug: "acme-corp", name: "Acme Corp" },
    { slug: "beta-labs", name: "Beta Labs" },
  ];

  const tenants = await Promise.all(
    tenantsData.map((t) =>
      prisma.tenant.upsert({
        where: { slug: t.slug },
        update: { name: t.name },
        create: t,
      })
    )
  );

  console.log(
    `${COLORS.green}  ✔ ${tenants.length} tenants seeded${COLORS.reset}`
  );

  //
  // 4) TENANT DOMAINS (separate table)
  //
  section("Seeding tenant domains");

 const domainData = [
  {
    slug: "central-hive",
    domain: "central.localhost", // http://central.localhost:3000
  },
  {
    slug: "acme-corp",
    domain: "acme.localhost", // http://acme.localhost:3000
  },
  {
    slug: "beta-labs",
    domain: "beta.localhost", // http://beta.localhost:3000
  },
];


  const tenantDomains = await Promise.all(
    domainData.map(async ({ slug, domain }) => {
      const tenant = tenants.find((t) => t.slug === slug);
      if (!tenant) {
        throw new Error(`Tenant not found for slug ${slug}`);
      }

      return prisma.tenantDomain.upsert({
        where: { tenantId: tenant.id }, // tenantId is @unique
        update: { domain },
        create: { tenantId: tenant.id, domain },
      });
    })
  );

  console.log(
    `${COLORS.green}  ✔ ${tenantDomains.length} tenant domains seeded${COLORS.reset}`
  );

  //
  // 5) USERS (central + tenant superadmins)
  //
  section("Seeding users (central + tenant superadmins)");

  const DEFAULT_PASSWORD = "Password123!";

  const centralUser = await ensureUser({
    name: "Central Superadmin",
    email: "central.admin@hive.test",
    password: DEFAULT_PASSWORD,
  });

  const acmeTenant = tenants.find((t) => t.slug === "acme-corp")!;
  const betaTenant = tenants.find((t) => t.slug === "beta-labs")!;
  const centralHiveTenant = tenants.find((t) => t.slug === "central-hive")!;

  const acmeAdmin = await ensureUser({
    name: "Acme Superadmin",
    email: "acme.admin@hive.test",
    password: DEFAULT_PASSWORD,
  });

  const betaAdmin = await ensureUser({
    name: "Beta Labs Superadmin",
    email: "beta.admin@hive.test",
    password: DEFAULT_PASSWORD,
  });

  const centralHiveAdmin = await ensureUser({
    name: "Central Hive Superadmin",
    email: "central.hive.admin@hive.test",
    password: DEFAULT_PASSWORD,
  });

  console.log(
    `${COLORS.green}  ✔ 4 admin users seeded/ensured${COLORS.reset}`
  );

  //
  // 6) USER ↔ TENANT MEMBERSHIPS
  //
  section("Linking users to tenants");

  async function ensureUserTenant(userId: string, tenantId: string) {
    await prisma.userTenant.upsert({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      update: {
        isOwner: true,
      },
      create: {
        userId,
        tenantId,
        isOwner: true,
      },
    });
  }

  await ensureUserTenant(acmeAdmin.id, acmeTenant.id);
  await ensureUserTenant(betaAdmin.id, betaTenant.id);
  await ensureUserTenant(centralHiveAdmin.id, centralHiveTenant.id);

  console.log(
    `${COLORS.green}  ✔ tenant memberships created (each tenant has one owner)${COLORS.reset}`
  );

  //
  // 7) USER ROLES
  //
  section("Assigning roles");

  async function ensureUserRole(opts: {
    userId: string;
    roleId: number;
    tenantId?: string | null;
  }) {
    const { userId, roleId, tenantId = null } = opts;

    await prisma.userRole.deleteMany({
      where: {
        roleId,
        tenantId,
      },
    });

    await prisma.userRole.create({
      data: {
        userId,
        roleId,
        tenantId,
      },
    });
  }

  await ensureUserRole({
    userId: centralUser.id,
    roleId: centralSuperAdmin.id,
    tenantId: null,
  });

  await ensureUserRole({
    userId: acmeAdmin.id,
    roleId: tenantSuperAdmin.id,
    tenantId: acmeTenant.id,
  });

  await ensureUserRole({
    userId: betaAdmin.id,
    roleId: tenantSuperAdmin.id,
    tenantId: betaTenant.id,
  });

  await ensureUserRole({
    userId: centralHiveAdmin.id,
    roleId: tenantSuperAdmin.id,
    tenantId: centralHiveTenant.id,
  });

  console.log(
    `${COLORS.green}  ✔ roles assigned (1 central superadmin, 1 per tenant)${COLORS.reset}`
  );

  //
  // 8) PRETTY SUMMARY
  //
  banner("Seed Complete");

  console.log(
    `${COLORS.bold}${COLORS.yellow}Seeded Admin Users:${COLORS.reset}\n`
  );

  const domainsBySlug: Record<string, string> = {};
  tenantDomains.forEach((td, i) => {
    const slug = tenants[i]?.slug;
    if (slug) domainsBySlug[slug] = td.domain;
  });

  const usersTable = [
    {
      label: "Central Superadmin",
      email: centralUser.email,
      password: DEFAULT_PASSWORD,
      tenant: "GLOBAL",
      domain: "-",
    },
    {
      label: "Acme Tenant Superadmin",
      email: acmeAdmin.email,
      password: DEFAULT_PASSWORD,
      tenant: "acme-corp",
      domain: domainsBySlug["acme-corp"],
    },
    {
      label: "Beta Tenant Superadmin",
      email: betaAdmin.email,
      password: DEFAULT_PASSWORD,
      tenant: "beta-labs",
      domain: domainsBySlug["beta-labs"],
    },
    {
      label: "Central Hive Tenant Superadmin",
      email: centralHiveAdmin.email,
      password: DEFAULT_PASSWORD,
      tenant: "central-hive",
      domain: domainsBySlug["central-hive"],
    },
  ];

  console.log(
    `${COLORS.cyan}┌────────────────────────────────────────────────────────────────────────────────────┐${COLORS.reset}`
  );
  console.log(
    `${COLORS.cyan}│ ${COLORS.bold}ROLE                         TENANT        DOMAIN              EMAIL                      PASSWORD ${COLORS.cyan}│${COLORS.reset}`
  );
  console.log(
    `${COLORS.cyan}├────────────────────────────────────────────────────────────────────────────────────┤${COLORS.reset}`
  );

  for (const u of usersTable) {
    const roleCell = (u.label + " ".repeat(28)).slice(0, 28);
    const tenantCell = (u.tenant + " ".repeat(12)).slice(0, 12);
    const domainCell = (u.domain + " ".repeat(18)).slice(0, 18);
    const emailCell = (u.email + " ".repeat(26)).slice(0, 26);
    const pwdCell = u.password;

    console.log(
      `${COLORS.cyan}│ ${COLORS.reset}${roleCell} ${tenantCell} ${domainCell} ${emailCell} ${pwdCell} ${COLORS.cyan}│${COLORS.reset}`
    );
  }

  console.log(
    `${COLORS.cyan}└────────────────────────────────────────────────────────────────────────────────────┘${COLORS.reset}\n`
  );

  console.log(
    `${COLORS.green}${COLORS.bold}You can now log in with any of the above users.${COLORS.reset}`
  );
}

main()
  .catch((e) => {
    console.error("Seed error", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
