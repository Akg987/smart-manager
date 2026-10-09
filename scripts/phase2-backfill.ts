import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import {
  SMART_MANAGER_PERMISSION_DEFINITIONS,
  SMART_MANAGER_PERMISSION_KEYS,
  SMART_MANAGER_COMPANY_ADMIN_GRANTS,
  SMART_MANAGER_ROLE_DOMAINS,
  SMART_MANAGER_ROLE_GRANTS,
  SMART_MANAGER_ROLE_SCOPE,
  SMART_MANAGER_SYSTEM_ROLES,
} from "../apps/api/src/module/permissions/smart-manager-catalog.js";

loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");
const catalogOnly = process.argv.includes("--catalog-only");
const legacyAdminMappingApproved = process.argv.includes(
  "--map-legacy-admins-to-company-admin",
);
if (
  process.argv
    .slice(2)
    .some(
      (argument) =>
        ![
          "--apply",
          "--dry-run",
          "--catalog-only",
          "--map-legacy-admins-to-company-admin",
        ].includes(argument),
    )
) {
  throw new Error(
    "Supported arguments: --dry-run (default), --apply, --catalog-only, --map-legacy-admins-to-company-admin.",
  );
}
if (apply && process.argv.includes("--dry-run")) {
  throw new Error("Choose either --dry-run or --apply.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const legacyPermissionMap: Readonly<Record<string, string>> = {
  "manage-modules": "integration.manage",
  "manage-settings": "integration.manage",
  "manage-users": "users.manage",
  "manage-roles": "roles.manage",
  "view-audit-log": "audit.view",
  "manage-departments": "company.manage",
  "access-all-departments": "company.view",
  "alerts.view": "alert.view",
  "alerts.acknowledge": "alert.acknowledge",
  "alerts.resolve": "alert.resolve",
  "actions.view": "action.view",
  "actions.manage": "action.manage",
  "actions.update-own": "action.update-own",
  "kpi.view": "kpi.view",
  "kpi.manage": "kpi.manage",
  "kpi.submit": "kpi.submit",
};

class DryRunRollback extends Error {}
type Tx = any;
const query = <T = Record<string, unknown>>(
  tx: Tx,
  text: string,
  values: unknown[] = [],
) => tx.unsafe(text, values) as Promise<T[]>;

function canonicalPermission(legacyKey: string) {
  const key = legacyKey.trim().toLowerCase();
  if ((SMART_MANAGER_PERMISSION_KEYS as readonly string[]).includes(key))
    return key;
  return legacyPermissionMap[key] ?? null;
}

async function ensureRole(
  tx: Tx,
  holdingId: string | null,
  key: string,
  name: string,
  isSystem: boolean,
) {
  const [existing] = await query<{ id: string }>(
    tx,
    holdingId === null
      ? "select id from roles where holding_id is null and key = $1 order by id limit 1"
      : "select id from roles where holding_id = $1 and key = $2 order by id limit 1",
    holdingId === null ? [key] : [holdingId, key],
  );
  if (existing) return existing.id;
  const [created] = await query<{ id: string }>(
    tx,
    `insert into roles (holding_id, key, name, is_system)
     values ($1, $2, $3, $4) returning id`,
    [holdingId, key, name.slice(0, 120), isSystem],
  );
  return created.id;
}

async function grant(
  tx: Tx,
  roleId: string,
  permissionId: string,
  scope: string,
  domain: string | null,
) {
  await query(
    tx,
    `insert into role_permissions (role_id, permission_id, scope_type, domain)
     values ($1, $2, $3, $4) on conflict (role_id, permission_id) do nothing`,
    [roleId, permissionId, scope, domain],
  );
}

async function run(tx: Tx) {
  await query(tx, "select pg_advisory_xact_lock(738202)");

  if (apply && !catalogOnly && !legacyAdminMappingApproved) {
    const legacyAdmins = await query<{ id: string }>(
      tx,
      "select id from users where role = 'admin' order by id",
    );
    if (legacyAdmins.length) {
      throw new Error(
        "Legacy admin role mapping requires explicit approval before applying the Phase 2 backfill.",
      );
    }
  }

  const [holding] = await query<{ id: string }>(
    tx,
    `insert into holdings (name, code, status, calendar, timezone, currency)
     values ($1, $2, 'active', 'jalali', 'Asia/Tehran', 'IRR')
     on conflict (code) do update set name = excluded.name, status = 'active'
     returning id`,
    ["هلدینگ اصلی", "holding-group"],
  );
  const [company] = await query<{ id: string }>(
    tx,
    `insert into companies (holding_id, name, code, status, calendar, currency)
     values ($1, $2, $3, 'active', 'jalali', 'IRR')
     on conflict (holding_id, code) do update set name = excluded.name, status = 'active'
     returning id`,
    [holding.id, "اسمارلوکس", "smarlux"],
  );

  const departments = await query<{
    id: string;
    name: string;
    code: string;
    manager_user_id: string | null;
  }>(tx, "select id, name, code, manager_user_id from departments order by id");
  for (const department of departments) {
    await query(
      tx,
      `insert into business_units (company_id, legacy_department_id, name, code, manager_user_id, domain, status)
       values ($1, $2, $3, $4, $5, 'general', 'active')
       on conflict (legacy_department_id) do update set
         company_id = excluded.company_id, name = excluded.name,
         manager_user_id = excluded.manager_user_id, status = 'active'`,
      [
        company.id,
        department.id,
        department.name,
        `dept-${department.id}`,
        department.manager_user_id,
      ],
    );
  }

  const permissionIds = new Map<string, string>();
  for (const definition of SMART_MANAGER_PERMISSION_DEFINITIONS) {
    const [permission] = await query<{ id: string }>(
      tx,
      `insert into permissions (key, resource, action, description, is_system)
       values ($1, $2, $3, $1, true)
       on conflict (key) do update set resource = excluded.resource, action = excluded.action
       returning id`,
      [definition.key, definition.resource, definition.action],
    );
    permissionIds.set(definition.key, permission.id);
  }

  const systemRoleIds = new Map<string, string>();
  for (const key of SMART_MANAGER_SYSTEM_ROLES) {
    const roleId = await ensureRole(tx, null, key, key, true);
    systemRoleIds.set(key, roleId);
    for (const permissionKey of SMART_MANAGER_ROLE_GRANTS[key]) {
      const permissionId = permissionIds.get(permissionKey);
      if (!permissionId)
        throw new Error(`Missing catalog permission: ${permissionKey}`);
      await grant(
        tx,
        roleId,
        permissionId,
        SMART_MANAGER_ROLE_SCOPE[key],
        SMART_MANAGER_ROLE_DOMAINS[key] ?? null,
      );
    }
  }

  const skippedPermissions = new Set<string>();
  const legacyUserRoleId = await ensureRole(
    tx,
    holding.id,
    "LEGACY_USER",
    "Legacy User",
    false,
  );
  const companyAdminRoleId = await ensureRole(
    tx,
    holding.id,
    "COMPANY_ADMIN",
    "Company Administrator",
    false,
  );
  for (const permissionKey of SMART_MANAGER_COMPANY_ADMIN_GRANTS) {
    const permissionId = permissionIds.get(permissionKey);
    if (!permissionId)
      throw new Error(`Missing catalog permission: ${permissionKey}`);
    await grant(tx, companyAdminRoleId, permissionId, "company", null);
  }
  const legacyUserGrants = await query<{ role: string; permission: string }>(
    tx,
    `select role, permission from role_permissions
     where role_id is null and permission_id is null and role = 'user' and permission is not null`,
  );
  for (const oldGrant of legacyUserGrants) {
    const key = canonicalPermission(oldGrant.permission);
    if (!key) {
      skippedPermissions.add(oldGrant.permission);
      continue;
    }
    const permissionId = permissionIds.get(key);
    if (!permissionId) throw new Error(`Missing catalog permission: ${key}`);
    // Legacy role-level grants were organization-wide; in this single-company backfill they become company grants.
    await grant(tx, legacyUserRoleId, permissionId, "company", null);
  }

  const accessLevels = await query<{
    id: string;
    name: string;
    department_id: string | null;
  }>(tx, "select id, name, department_id from access_levels order by id");
  const accessRole = new Map<
    string,
    { roleId: string; departmentId: string | null }
  >();
  for (const level of accessLevels) {
    const roleId = await ensureRole(
      tx,
      holding.id,
      `LEGACY_ACCESS_${level.id}`,
      level.name,
      false,
    );
    accessRole.set(level.id, { roleId, departmentId: level.department_id });
    const mappedUnit = level.department_id
      ? (
          await query<{ id: string }>(
            tx,
            "select id from business_units where company_id = $1 and legacy_department_id = $2 limit 1",
            [company.id, level.department_id],
          )
        )[0]
      : undefined;
    if (level.department_id && !mappedUnit)
      throw new Error(
        `Access level ${level.id} references an unmapped department.`,
      );
    const oldGrants = await query<{ permission: string }>(
      tx,
      "select permission from access_level_permissions where access_level_id = $1 order by permission",
      [level.id],
    );
    for (const oldGrant of oldGrants) {
      const key = canonicalPermission(oldGrant.permission);
      if (!key) {
        skippedPermissions.add(oldGrant.permission);
        continue;
      }
      const permissionId = permissionIds.get(key);
      if (!permissionId) throw new Error(`Missing catalog permission: ${key}`);
      // Department-bound access levels remain at that Business Unit; unbound levels are company-scoped.
      await grant(
        tx,
        roleId,
        permissionId,
        mappedUnit ? "businessUnit" : "company",
        mappedUnit ? "general" : null,
      );
    }
  }

  const users = await query<{
    id: string;
    role: string;
    department_id: string | null;
    access_level_id: string | null;
  }>(
    tx,
    "select id, role, department_id, access_level_id from users order by id",
  );
  if (catalogOnly) {
    return {
      holdingId: holding.id,
      holdingName: "هلدینگ اصلی",
      companyId: company.id,
      companyName: "اسمارلوکس",
      departmentsMappedToBusinessUnits: departments.length,
      usersReviewed: users.length,
      membershipAssignmentsPendingReview: users.length,
      membershipsCreated: 0,
      membershipRoleLinks: 0,
      auditRows: 0,
      skippedUnmappedPermissions: skippedPermissions.size,
      unmappedPermissionKeys: [...skippedPermissions].sort(),
    };
  }
  let membershipsCreated = 0;
  let membershipRoleLinks = 0;
  let auditRows = 0;
  for (const user of users) {
    const access = user.access_level_id
      ? accessRole.get(user.access_level_id)
      : undefined;
    if (
      user.department_id &&
      access?.departmentId &&
      user.department_id !== access.departmentId
    ) {
      throw new Error(
        `User ${user.id} department differs from access level ${user.access_level_id}; resolve this before applying.`,
      );
    }
    const departmentId = user.department_id ?? access?.departmentId ?? null;
    const unit = departmentId
      ? (
          await query<{ id: string }>(
            tx,
            "select id from business_units where company_id = $1 and legacy_department_id = $2 limit 1",
            [company.id, departmentId],
          )
        )[0]
      : undefined;
    if (departmentId && !unit)
      throw new Error(`User ${user.id} references an unmapped department.`);
    const currentMemberships = await query<{
      id: string;
      company_id: string | null;
      business_unit_id: string | null;
    }>(
      tx,
      `select id, company_id, business_unit_id from memberships
       where user_id = $1 and holding_id = $2 and status = 'active' order by id`,
      [user.id, holding.id],
    );
    const exact = currentMemberships.find(
      (membership) =>
        membership.company_id === company.id &&
        membership.business_unit_id === (unit?.id ?? null),
    );
    if (currentMemberships.length && !exact) {
      throw new Error(
        `User ${user.id} already has a different active membership in the target holding.`,
      );
    }
    const scope =
      user.role === "admin" ? "company" : unit ? "businessUnit" : "company";
    let membershipId = exact?.id;
    if (!membershipId) {
      const [created] = await query<{ id: string }>(
        tx,
        `insert into memberships (user_id, holding_id, company_id, business_unit_id, scope_type, status, is_default)
         values ($1, $2, $3, $4, $5, 'active', true) returning id`,
        [user.id, holding.id, company.id, unit?.id ?? null, scope],
      );
      membershipId = created.id;
      membershipsCreated++;
    }
    const roles =
      user.role === "admin"
        ? [companyAdminRoleId]
        : [legacyUserRoleId, ...(access ? [access.roleId] : [])];
    for (const roleId of roles) {
      if (!roleId) continue;
      await query(
        tx,
        "insert into membership_roles (membership_id, role_id) values ($1, $2) on conflict (membership_id, role_id) do nothing",
        [membershipId, roleId],
      );
      membershipRoleLinks++;
    }
    if (!exact) {
      await query(
        tx,
        `insert into audit_logs (user_id, holding_id, company_id, actor_name, action, subject_type, subject_id, description, context)
         values (null, $1, $2, 'System Backfill', 'tenant.membership.backfilled', 'User', $3, 'Legacy user assigned to the approved holding/company scope', $4::json)`,
        [
          holding.id,
          company.id,
          user.id,
          JSON.stringify({
            old: {
              role: user.role,
              departmentId: user.department_id,
              accessLevelId: user.access_level_id,
            },
            new: {
              companyId: company.id,
              businessUnitId: unit?.id ?? null,
              scopeType: scope,
              roles:
                user.role === "admin"
                  ? ["COMPANY_ADMIN"]
                  : [
                      "LEGACY_USER",
                      ...(access
                        ? [`LEGACY_ACCESS_${user.access_level_id}`]
                        : []),
                    ],
            },
          }),
        ],
      );
      auditRows++;
    }
  }

  return {
    holdingId: holding.id,
    holdingName: "هلدینگ اصلی",
    companyId: company.id,
    companyName: "اسمارلوکس",
    departmentsMappedToBusinessUnits: departments.length,
    usersReviewed: users.length,
    membershipsCreated,
    membershipRoleLinks,
    auditRows,
    skippedUnmappedPermissions: skippedPermissions.size,
    unmappedPermissionKeys: [...skippedPermissions].sort(),
  };
}

const db = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  let summary: Awaited<ReturnType<typeof run>> | undefined;
  try {
    await db.begin(async (tx) => {
      summary = await run(tx);
      if (!apply) throw new DryRunRollback();
    });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  }
  console.log(
    JSON.stringify(
      {
        mode: apply ? "applied" : "dry-run",
        scope: catalogOnly ? "catalog-only" : "full-backfill",
        ...summary,
      },
      null,
      2,
    ),
  );
} finally {
  await db.end();
}
