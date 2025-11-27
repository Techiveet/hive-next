// prisma/seed.ts

import { PrismaClient, RoleScope } from "@prisma/client";

import { auth } from "../lib/auth";
import { syncCentralSuperAdminPermissions } from "../lib/rbac";

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

/**
 * Create a user via Better Auth if it does not exist yet.
 * Ensures password hashing + account rows are correct.
 * Also auto-verifies + activates seeded admins.
 */
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

  // Auto-verify and enable seeded admins
  return prisma.user.update({
    where: { id: created.id },
    data: { emailVerified: true, isActive: true },
  });
}

/**
 * Ensure membership in a tenant.
 */
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

/**
 * Seeder-only helper:
 * For a given (roleId, tenantId), ensure exactly ONE user has that role.
 * We delete any existing holder for that role+tenant and assign to this user.
 * This guarantees:
 * - ONE central_superadmin user (tenantId = null)
 * - ONE tenant_superadmin user per tenant.
 */
async function ensureUserRole(opts: {
  userId: string;
  roleId: number;
  tenantId?: string | null;
}) {
  const { userId, roleId, tenantId = null } = opts;

  await prisma.userRole.deleteMany({
    where: { roleId, tenantId },
  });

  await prisma.userRole.create({
    data: {
      userId,
      roleId,
      tenantId,
    },
  });
}

async function main() {
  banner("Hive Seed – Roles, Permissions, Tenants & Superadmins");

  // 1) PERMISSIONS – GLOBAL (tenantId = null)
  section("Seeding permissions");

  const permissionsData = [
    // core system / central only
    { key: "manage_tenants", name: "Manage Tenants" },
    { key: "manage_billing", name: "Manage Billing & Subscriptions" },
    { key: "view_audit_logs", name: "View Audit Logs" },

    // security
    { key: "view_security", name: "View Security Area" },
    { key: "manage_security", name: "Manage Security (Users/Roles)" },

    // user / role granular
    { key: "manage_users", name: "Manage Users" },
    { key: "manage_roles", name: "Manage Roles & Permissions" },

    // file manager
    { key: "manage_files", name: "Manage Files & Folders" },
    { key: "manage_storage_settings", name: "Manage Storage Settings" },
  ];

  await prisma.permission.createMany({
    data: permissionsData.map((p) => ({
      key: p.key,
      name: p.name,
      tenantId: null,
    })),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany({
    where: { tenantId: null },
  });

  console.log(
    `${COLORS.green}  ✔ ${permissions.length} permissions seeded${COLORS.reset}`
  );

  const permByKey = new Map(permissions.map((p) => [p.key, p.id]));

  function rolePerms(roleId: number, keys: string[]) {
    return keys
      .map((k) => {
        const pid = permByKey.get(k);
        return pid ? { roleId, permissionId: pid } : null;
      })
      .filter(Boolean) as { roleId: number; permissionId: number }[];
  }

  // 2) TENANTS
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

  const centralHiveTenant = tenants.find((t) => t.slug === "central-hive")!;
  const acmeTenant = tenants.find((t) => t.slug === "acme-corp")!;
  const betaTenant = tenants.find((t) => t.slug === "beta-labs")!;

  // 3) CENTRAL ROLE (GLOBAL, UNIQUE) – manual find/update/create
  section("Seeding central role");

  let centralSuperAdmin = await prisma.role.findFirst({
    where: {
      key: "central_superadmin",
      tenantId: null,
    },
  });

  if (centralSuperAdmin) {
    centralSuperAdmin = await prisma.role.update({
      where: { id: centralSuperAdmin.id },
      data: {
        name: "Central Super Administrator",
        scope: RoleScope.CENTRAL,
        tenantId: null,
      },
    });
  } else {
    centralSuperAdmin = await prisma.role.create({
      data: {
        key: "central_superadmin",
        name: "Central Super Administrator",
        scope: RoleScope.CENTRAL,
        tenantId: null,
      },
    });
  }

  // 4) TENANT ROLES (PER TENANT – UNIQUE PER TENANT)
  section("Seeding tenant roles");

  type TenantRoleIds = {
    superadminId: number;
    adminId: number;
    memberId: number;
  };

  const tenantRolesByTenantId: Record<string, TenantRoleIds> = {};

  for (const tenant of tenants) {
    const superadmin = await prisma.role.upsert({
      where: {
        tenantId_key: {
          tenantId: tenant.id,
          key: "tenant_superadmin",
        },
      },
      update: {
        name: "Tenant Super Administrator",
        scope: RoleScope.TENANT,
      },
      create: {
        key: "tenant_superadmin",
        name: "Tenant Super Administrator",
        scope: RoleScope.TENANT,
        tenantId: tenant.id,
      },
    });

    const admin = await prisma.role.upsert({
      where: {
        tenantId_key: {
          tenantId: tenant.id,
          key: "tenant_admin",
        },
      },
      update: {
        name: "Tenant Administrator",
        scope: RoleScope.TENANT,
      },
      create: {
        key: "tenant_admin",
        name: "Tenant Administrator",
        scope: RoleScope.TENANT,
        tenantId: tenant.id,
      },
    });

    const member = await prisma.role.upsert({
      where: {
        tenantId_key: {
          tenantId: tenant.id,
          key: "tenant_member",
        },
      },
      update: {
        name: "Tenant Member",
        scope: RoleScope.TENANT,
      },
      create: {
        key: "tenant_member",
        name: "Tenant Member",
        scope: RoleScope.TENANT,
        tenantId: tenant.id,
      },
    });

    tenantRolesByTenantId[tenant.id] = {
      superadminId: superadmin.id,
      adminId: admin.id,
      memberId: member.id,
    };
  }

  // 5) ROLE PERMISSIONS (CENTRAL + TENANT)
  section("Seeding role permissions");

  const allPermKeys = permissions.map((p) => p.key);
  const tenantPermKeys = allPermKeys.filter((k) => k !== "manage_tenants");

  const allRoleIds = [
    centralSuperAdmin.id,
    ...Object.values(tenantRolesByTenantId).flatMap((r) => [
      r.superadminId,
      r.adminId,
      r.memberId,
    ]),
  ];

  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: allRoleIds } },
  });

  const rolePermissionsData = [
    // CENTRAL SUPERADMIN → all permissions
    ...rolePerms(centralSuperAdmin.id, allPermKeys),

    // per-tenant roles
    ...Object.values(tenantRolesByTenantId).flatMap((r) => [
      // tenant superadmin → all except manage_tenants
      ...rolePerms(r.superadminId, tenantPermKeys),
      // tenant admin → same as superadmin for now
      ...rolePerms(r.adminId, tenantPermKeys),
      // tenant member → files only
      ...rolePerms(r.memberId, ["manage_files"]),
    ]),
  ];

  await prisma.rolePermission.createMany({
    data: rolePermissionsData,
    skipDuplicates: true,
  });

  console.log(
    `${COLORS.green}  ✔ central + tenant roles seeded with permissions${COLORS.reset}`
  );

  // 6) TENANT DOMAINS
  section("Seeding tenant domains");

  const domainData = [
    { slug: "central-hive", domain: "central.localhost" },
    { slug: "acme-corp", domain: "acme.localhost" },
    { slug: "beta-labs", domain: "beta.localhost" },
  ];

  const tenantDomains = await Promise.all(
    domainData.map(async ({ slug, domain }) => {
      const tenant = tenants.find((t) => t.slug === slug);
      if (!tenant) {
        throw new Error(`Tenant not found for slug ${slug}`);
      }
      return prisma.tenantDomain.upsert({
        where: { tenantId: tenant.id },
        update: { domain },
        create: { tenantId: tenant.id, domain },
      });
    })
  );

  console.log(
    `${COLORS.green}  ✔ ${tenantDomains.length} tenant domains seeded${COLORS.reset}`
  );

  // 7) USERS (CENTRAL + TENANT SUPERADMINS)
  section("Seeding users (central + tenant superadmins)");

  const DEFAULT_PASSWORD = "Password123!";

  // EXACTLY ONE central superadmin user
  const centralUser = await ensureUser({
    name: "Central Superadmin",
    email: "central.admin@hive.test",
    password: DEFAULT_PASSWORD,
  });

  // EXACTLY ONE tenant superadmin user per tenant
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

  // 8) USER ↔ TENANT MEMBERSHIPS
  section("Linking users to tenants");

  await ensureUserTenant(acmeAdmin.id, acmeTenant.id);
  await ensureUserTenant(betaAdmin.id, betaTenant.id);
  await ensureUserTenant(centralHiveAdmin.id, centralHiveTenant.id);

  console.log(
    `${COLORS.green}  ✔ tenant memberships created (one owner per tenant)${COLORS.reset}`
  );

  // 9) USER ROLES – ENFORCE ONE HOLDER PER SUPERADMIN ROLE
  section("Assigning roles");

  // GLOBAL central superadmin (no tenantId)
  await ensureUserRole({
    userId: centralUser.id,
    roleId: centralSuperAdmin.id,
    tenantId: null,
  });

  // tenant superadmins (per-tenant)
  await ensureUserRole({
    userId: acmeAdmin.id,
    roleId: tenantRolesByTenantId[acmeTenant.id].superadminId,
    tenantId: acmeTenant.id,
  });

  await ensureUserRole({
    userId: betaAdmin.id,
    roleId: tenantRolesByTenantId[betaTenant.id].superadminId,
    tenantId: betaTenant.id,
  });

  await ensureUserRole({
    userId: centralHiveAdmin.id,
    roleId: tenantRolesByTenantId[centralHiveTenant.id].superadminId,
    tenantId: centralHiveTenant.id,
  });

  console.log(
    `${COLORS.green}  ✔ roles assigned (1 central superadmin user, 1 tenant superadmin user per tenant)${COLORS.reset}`
  );

  // 10) KEEP CENTRAL SUPERADMIN PERMISSIONS IN SYNC
  section("Syncing central_superadmin permissions");
  await syncCentralSuperAdminPermissions();
  console.log(
    `${COLORS.green}  ✔ central_superadmin permissions synced${COLORS.reset}`
  );

  // 11) SUMMARY
  banner("Seed Complete");

  console.log(
    `${COLORS.bold}${COLORS.yellow}Seeded Admin Users:${COLORS.reset}\n`
  );

  const domainsBySlug: Record<string, string> = {};
  tenantDomains.forEach((td) => {
    const tenant = tenants.find((t) => t.id === td.tenantId);
    if (tenant) domainsBySlug[tenant.slug] = td.domain;
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
    `${COLORS.cyan}│ ${COLORS.bold}ROLE                         TENANT        DOMAIN              EMAIL                       PASSWORD ${COLORS.cyan}│${COLORS.reset}`
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
