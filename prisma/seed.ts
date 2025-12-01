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

  // ---------------------------------------------------------------------------
  // 1) PERMISSIONS – GLOBAL (tenantId = null)
  // ---------------------------------------------------------------------------
  section("Seeding permissions");

  // 🔥 IMPORTANT: clear old role-permissions & system permissions so we
  // don't double-insert on every seed run.
  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({
    where: { tenantId: null }, // only system/global perms
  });

  const permissionsData = [
    // --- Dashboard / general -------------------------------------------------
    { key: "dashboard.view", name: "View Dashboard" },

    // --- core system / central only -----------------------------------------
    { key: "manage_tenants", name: "Manage Tenants" },
    { key: "manage_settings", name: "Manage Settings" },
    { key: "manage_billing", name: "Manage Billing & Subscriptions" },
    { key: "view_audit_logs", name: "View Audit Logs" },

    // --- security area (high-level switches) --------------------------------
    { key: "view_security", name: "View Security Area" },
    { key: "manage_security", name: "Manage Security (Users/Roles)" },

    // --- USERS: CRUD permissions --------------------------------------------
    { key: "users.view", name: "View Users" },
    { key: "users.create", name: "Create Users" },
    { key: "users.update", name: "Update Users" },
    { key: "users.delete", name: "Delete Users" },

    // --- ROLES: CRUD permissions --------------------------------------------
    { key: "roles.view", name: "View Roles" },
    { key: "roles.create", name: "Create Roles" },
    { key: "roles.update", name: "Update Roles" },
    { key: "roles.delete", name: "Delete Roles" },

    // --- PERMISSIONS: CRUD permissions --------------------------------------
    { key: "permissions.view", name: "View Permissions" },
    { key: "permissions.create", name: "Create Permissions" },
    { key: "permissions.update", name: "Update Permissions" },
    { key: "permissions.delete", name: "Delete Permissions" },

    // --- coarse-grained legacy flags (keep for existing checks) -------------
    { key: "manage_users", name: "Manage Users" },
    { key: "manage_roles", name: "Manage Roles & Permissions" },

    // --- file manager --------------------------------------------------------
    { key: "files.view", name: "View Files" },
    { key: "files.upload", name: "Upload Files" },
    { key: "files.update", name: "Rename / Move Files" },
    { key: "files.delete", name: "Delete Files" },
    { key: "folders.view", name: "View Folders" },
    { key: "folders.create", name: "Create Folders" },
    { key: "folders.update", name: "Rename / Move Folders" },
    { key: "folders.delete", name: "Delete Folders" },
    { key: "manage_files", name: "Manage Files & Folders" },
    { key: "manage_storage_settings", name: "Manage Storage Settings" },

    // --- settings: brand / company / email / notifications / localization ---
    { key: "settings.brand.view", name: "View Brand Settings" },
    { key: "settings.brand.update", name: "Update Brand Settings" },
    { key: "settings.company.view", name: "View Company Settings" },
    { key: "settings.company.update", name: "Update Company Settings" },
    { key: "settings.email.view", name: "View Email Settings" },
    { key: "settings.email.update", name: "Update Email Settings" },
    {
      key: "settings.notifications.view",
      name: "View Notification Settings",
    },
    {
      key: "settings.notifications.update",
      name: "Update Notification Settings",
    },
    {
      key: "settings.localization.view",
      name: "View Localization / Languages",
    },
    {
      key: "settings.localization.update",
      name: "Manage Localization / Languages",
    },

    // --- departments / org structure ----------------------------------------
    { key: "departments.view", name: "View Departments" },
    { key: "departments.create", name: "Create Departments" },
    { key: "departments.update", name: "Update Departments" },
    { key: "departments.delete", name: "Delete Departments" },

    // --- inventory: goods / categories / units / shelves --------------------
    { key: "inventory.view", name: "View Inventory Overview" },
    { key: "inventory.manage", name: "Manage Inventory" },

    { key: "products.view", name: "View Goods / Products" },
    { key: "products.create", name: "Create Goods / Products" },
    { key: "products.update", name: "Update Goods / Products" },
    { key: "products.delete", name: "Delete Goods / Products" },
    { key: "products.export", name: "Export Goods / Products" },
    { key: "products.print", name: "Print Goods / Products" },

    {
      key: "product_categories.view",
      name: "View Product Categories",
    },
    {
      key: "product_categories.create",
      name: "Create Product Categories",
    },
    {
      key: "product_categories.update",
      name: "Update Product Categories",
    },
    {
      key: "product_categories.delete",
      name: "Delete Product Categories",
    },

    { key: "units.view", name: "View Units of Measure" },
    { key: "units.create", name: "Create Units of Measure" },
    { key: "units.update", name: "Update Units of Measure" },
    { key: "units.delete", name: "Delete Units of Measure" },

    { key: "shelves.view", name: "View Shelves / Locations" },
    { key: "shelves.create", name: "Create Shelves / Locations" },
    { key: "shelves.update", name: "Update Shelves / Locations" },
    { key: "shelves.delete", name: "Delete Shelves / Locations" },

    { key: "stock_adjustments.view", name: "View Stock Adjustments" },
    { key: "stock_adjustments.create", name: "Create Stock Adjustments" },
    { key: "stock_adjustments.update", name: "Update Stock Adjustments" },
    { key: "stock_adjustments.delete", name: "Delete Stock Adjustments" },

    // --- suppliers / vendors ------------------------------------------------
    { key: "suppliers.view", name: "View Suppliers" },
    { key: "suppliers.create", name: "Create Suppliers" },
    { key: "suppliers.update", name: "Update Suppliers" },
    { key: "suppliers.delete", name: "Delete Suppliers" },

    { key: "vendors.view", name: "View Vendors" },
    { key: "vendors.create", name: "Create Vendors" },
    { key: "vendors.update", name: "Update Vendors" },
    { key: "vendors.delete", name: "Delete Vendors" },

    {
      key: "vendor_opening_balances.view",
      name: "View Vendor Opening Balances",
    },
    {
      key: "vendor_opening_balances.create",
      name: "Create Vendor Opening Balances",
    },
    {
      key: "vendor_opening_balances.update",
      name: "Update Vendor Opening Balances",
    },
    {
      key: "vendor_opening_balances.delete",
      name: "Delete Vendor Opening Balances",
    },

    // --- purchase requests / purchase orders / approvals --------------------
    { key: "purchase_requests.view", name: "View Purchase Requests" },
    { key: "purchase_requests.create", name: "Create Purchase Requests" },
    { key: "purchase_requests.update", name: "Update Purchase Requests" },
    { key: "purchase_requests.delete", name: "Delete Purchase Requests" },
    { key: "purchase_requests.approve", name: "Approve Purchase Requests" },
    { key: "purchase_requests.export", name: "Export Purchase Requests" },
    { key: "purchase_requests.print", name: "Print Purchase Requests" },

    { key: "purchase_orders.view", name: "View Purchase Orders" },
    { key: "purchase_orders.create", name: "Create Purchase Orders" },
    { key: "purchase_orders.update", name: "Update Purchase Orders" },
    { key: "purchase_orders.delete", name: "Delete Purchase Orders" },
    { key: "purchase_orders.approve", name: "Approve Purchase Orders" },
    { key: "purchase_orders.export", name: "Export Purchase Orders" },
    { key: "purchase_orders.print", name: "Print Purchase Orders" },

    {
      key: "purchase_approvals.view",
      name: "View Purchase Approvals",
    },
    {
      key: "purchase_approvals.approve",
      name: "Approve / Reject Purchase Requests",
    },

    // --- transfers ----------------------------------------------------------
    { key: "transfers.view", name: "View Inventory Transfers" },
    { key: "transfers.create", name: "Create Inventory Transfers" },
    { key: "transfers.update", name: "Update Inventory Transfers" },
    { key: "transfers.delete", name: "Delete Inventory Transfers" },
    { key: "transfers.approve", name: "Approve Inventory Transfers" },

    // --- goods receiving / GRN ----------------------------------------------
    {
      key: "goods_receiving.view",
      name: "View Goods Receiving Notes",
    },
    {
      key: "goods_receiving.create",
      name: "Create Goods Receiving Notes",
    },
    {
      key: "goods_receiving.update",
      name: "Update Goods Receiving Notes",
    },
    {
      key: "goods_receiving.delete",
      name: "Delete Goods Receiving Notes",
    },
    {
      key: "goods_receiving.approve",
      name: "Approve / Sign Goods Receiving Notes",
    },
    {
      key: "goods_receiving.print",
      name: "Print Goods Receiving Notes",
    },

    // --- invoices / finance -------------------------------------------------
    { key: "invoices.view", name: "View Invoices" },
    { key: "invoices.create", name: "Create Invoices" },
    { key: "invoices.update", name: "Update Invoices" },
    { key: "invoices.delete", name: "Delete Invoices" },
    { key: "invoices.approve", name: "Approve Invoices" },
    { key: "invoices.print", name: "Print Invoices" },
    { key: "invoices.export", name: "Export Invoices" },

    { key: "payments.view", name: "View Payments" },
    { key: "payments.create", name: "Create Payments" },
    { key: "payments.update", name: "Update Payments" },
    { key: "payments.delete", name: "Delete Payments" },

    { key: "finance_reports.view", name: "View Finance Reports" },

    // --- notifications / realtime events -----------------------------------
    { key: "notifications.view", name: "View Notifications" },
    { key: "notifications.manage", name: "Manage Notification Rules" },

    // --- exports / print (generic) -----------------------------------------
    { key: "export.csv", name: "Export to CSV" },
    { key: "export.excel", name: "Export to Excel" },
    { key: "export.pdf", name: "Export to PDF" },
    { key: "print.view", name: "Use Print Views" },

    // --- marketplace / subscriptions ---------------------------------------
    { key: "plans.view", name: "View Subscription Plans" },
    { key: "plans.manage", name: "Manage Subscription Plans" },
    { key: "subscriptions.view", name: "View Subscriptions" },
    { key: "subscriptions.manage", name: "Manage Subscriptions" },
  ];

  await prisma.permission.createMany({
    data: permissionsData.map((p) => ({
      key: p.key,
      name: p.name,
      tenantId: null, // global/system permissions
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

  // ---------------------------------------------------------------------------
  // 2) TENANTS
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 3) CENTRAL ROLE (GLOBAL, UNIQUE – tenantId = null)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 4) TENANT ROLES (PER TENANT – UNIQUE PER TENANT)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 5) ROLE PERMISSIONS (CENTRAL + TENANT)
  // ---------------------------------------------------------------------------
  section("Seeding role permissions");

  const allPermKeys = permissions.map((p) => p.key);

  // everything except manage_tenants is allowed for tenant roles
  const tenantPermKeys = allPermKeys.filter((k) => k !== "manage_tenants");

  const allRoleIds = [
    centralSuperAdmin.id,
    ...Object.values(tenantRolesByTenantId).flatMap((r) => [
      r.superadminId,
      r.adminId,
      r.memberId,
    ]),
  ];

  // rolePermission for these role IDs is already wiped at top,
  // but calling again is harmless. You can remove this if you want.
  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: allRoleIds } },
  });

  const rolePermissionsData = [
    // CENTRAL SUPERADMIN → all permissions
    ...rolePerms(centralSuperAdmin.id, allPermKeys),

    // PER-TENANT ROLES
    ...Object.values(tenantRolesByTenantId).flatMap((r) => [
      // tenant superadmin → all except manage_tenants
      ...rolePerms(r.superadminId, tenantPermKeys),
      // tenant admin → same as superadmin for now
      ...rolePerms(r.adminId, tenantPermKeys),
      // tenant member → files only (plus whatever else you want)
      ...rolePerms(r.memberId, ["manage_files", "files.view", "files.upload"]),
    ]),
  ];

  await prisma.rolePermission.createMany({
    data: rolePermissionsData,
    skipDuplicates: true,
  });

  console.log(
    `${COLORS.green}  ✔ central + tenant roles seeded with permissions${COLORS.reset}`
  );

  // ---------------------------------------------------------------------------
  // 6) TENANT DOMAINS
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 7) USERS (CENTRAL + TENANT SUPERADMINS)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 8) USER ↔ TENANT MEMBERSHIPS
  // ---------------------------------------------------------------------------
  section("Linking users to tenants");

  await ensureUserTenant(acmeAdmin.id, acmeTenant.id);
  await ensureUserTenant(betaAdmin.id, betaTenant.id);
  await ensureUserTenant(centralHiveAdmin.id, centralHiveTenant.id);

  console.log(
    `${COLORS.green}  ✔ tenant memberships created (one owner per tenant)${COLORS.reset}`
  );

  // ---------------------------------------------------------------------------
  // 9) USER ROLES – ENFORCE ONE HOLDER PER SUPERADMIN ROLE
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 10) KEEP CENTRAL SUPERADMIN PERMISSIONS IN SYNC
  // ---------------------------------------------------------------------------
  section("Syncing central_superadmin permissions");
  await syncCentralSuperAdminPermissions();
  console.log(
    `${COLORS.green}  ✔ central_superadmin permissions synced${COLORS.reset}`
  );

  // ---------------------------------------------------------------------------
  // 11) SUMMARY
  // ---------------------------------------------------------------------------
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
