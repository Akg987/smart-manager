import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canWithGrants,
  isDelegableRole,
  scopeContainsScope,
} from "../permissions/smart-manager-authorization.js";
import {
  SMART_MANAGER_COMPANY_ADMIN_GRANTS,
  SMART_MANAGER_PERMISSION_KEYS,
  SMART_MANAGER_ROLE_GRANTS,
  SMART_MANAGER_ROLE_SCOPE,
  SMART_MANAGER_SYSTEM_ROLES,
} from "../permissions/smart-manager-catalog.js";

const context = (scopeType: string) => ({
  userId: "7",
  holdingId: "1",
  membershipId: "9",
  companyId: "11",
  branchId: null,
  businessUnitId: null,
  roleIds: ["4"],
  scopeType,
});

test("holding scope accepts companies in the same holding and rejects other holdings", () => {
  const grants = [
    { permission: "dashboard.view", scopeType: "holding", domain: null },
  ];
  assert.equal(
    canWithGrants(
      context("holding"),
      "dashboard.view",
      { holdingId: "1", companyId: "12" },
      grants,
    ),
    true,
  );
  assert.equal(
    canWithGrants(
      context("holding"),
      "dashboard.view",
      { holdingId: "2", companyId: "21" },
      grants,
    ),
    false,
  );
  assert.equal(
    canWithGrants(
      context("holding"),
      "dashboard.view",
      { companyId: "12" },
      grants,
    ),
    false,
  );
});

test("company scope denies a resource from another company", () => {
  const grants = [
    { permission: "kpi.view", scopeType: "company", domain: null },
  ];
  assert.equal(
    canWithGrants(
      context("company"),
      "kpi.view",
      { holdingId: "1", companyId: "11" },
      grants,
    ),
    true,
  );
  assert.equal(
    canWithGrants(
      context("company"),
      "kpi.view",
      { holdingId: "1", companyId: "12" },
      grants,
    ),
    false,
  );
  assert.equal(
    canWithGrants(context("company"), "kpi.view", { holdingId: "1" }, grants),
    false,
  );
  assert.equal(
    canWithGrants(context("company"), "kpi.view", { companyId: "11" }, grants),
    false,
  );
});

test("domain, own, and assigned scopes require their matching resource owner", () => {
  assert.equal(
    canWithGrants(
      context("domain"),
      "kpi.view",
      { holdingId: "1", companyId: "11", domain: "sales" },
      [{ permission: "kpi.view", scopeType: "domain", domain: "sales" }],
    ),
    true,
  );
  assert.equal(
    canWithGrants(
      context("domain"),
      "kpi.view",
      { companyId: "11", domain: "sales" },
      [{ permission: "kpi.view", scopeType: "domain", domain: "sales" }],
    ),
    false,
  );
  assert.equal(
    canWithGrants(
      context("domain"),
      "kpi.view",
      { companyId: "11", domain: "finance" },
      [{ permission: "kpi.view", scopeType: "domain", domain: "sales" }],
    ),
    false,
  );
  assert.equal(
    canWithGrants(
      context("own"),
      "action.update",
      { holdingId: "1", companyId: "11", ownerId: "7" },
      [{ permission: "action.update", scopeType: "own", domain: null }],
    ),
    true,
  );
  assert.equal(
    canWithGrants(
      context("own"),
      "action.update",
      { companyId: "11", ownerId: "7" },
      [{ permission: "action.update", scopeType: "own", domain: null }],
    ),
    false,
  );
  assert.equal(
    canWithGrants(
      context("assigned"),
      "kpi.submit",
      { companyId: "11", assignedUserId: "8" },
      [{ permission: "kpi.submit", scopeType: "assigned", domain: null }],
    ),
    false,
  );
});

test("action manage and update-own grants do not imply each other", () => {
  const resource = { holdingId: "1", companyId: "11", ownerId: "7" };
  const manageGrant = [
    { permission: "action.manage", scopeType: "own", domain: null },
  ];
  const updateOwnGrant = [
    { permission: "action.update-own", scopeType: "own", domain: null },
  ];
  assert.equal(
    canWithGrants(context("own"), "action.manage", resource, manageGrant),
    true,
  );
  assert.equal(
    canWithGrants(context("own"), "action.update-own", resource, manageGrant),
    false,
  );
  assert.equal(
    canWithGrants(
      context("own"),
      "action.update-own",
      resource,
      updateOwnGrant,
    ),
    true,
  );
  assert.equal(
    canWithGrants(context("own"), "action.manage", resource, updateOwnGrant),
    false,
  );
});

test("unknown permissions and missing contexts fail closed", () => {
  assert.equal(
    canWithGrants(undefined, "kpi.view", { companyId: "11" }, [
      { permission: "kpi.view", scopeType: "company", domain: null },
    ]),
    false,
  );
  assert.equal(
    canWithGrants(context("company"), "kpi.export", { companyId: "11" }, [
      { permission: "kpi.export", scopeType: "company", domain: null },
    ]),
    false,
  );
});

test("the Smart Manager role catalog includes all requested roles and only registered permissions", () => {
  assert.equal(SMART_MANAGER_SYSTEM_ROLES.length, 14);
  for (const grants of Object.values(SMART_MANAGER_ROLE_GRANTS)) {
    for (const grant of grants)
      assert.ok(
        (SMART_MANAGER_PERMISSION_KEYS as readonly string[]).includes(grant),
      );
  }
});

test("technical admins receive no commercial permissions and retain their narrow scope", () => {
  const technical = SMART_MANAGER_ROLE_GRANTS.TECHNICAL_ADMIN;
  assert.equal(SMART_MANAGER_ROLE_SCOPE.TECHNICAL_ADMIN, "own");
  assert.ok(technical.includes("roles.manage"));
  assert.ok(technical.includes("permissions.manage"));
  assert.equal(
    technical.some((permission) =>
      ["kpi.view", "dashboard.view", "report.view", "ai.view"].includes(
        permission,
      ),
    ),
    false,
  );
});

test("delegated permissions must be a subset of the actor permission scope", () => {
  const holding = {
    holdingId: "1",
    companyId: null,
    branchId: null,
    businessUnitId: null,
  };
  const company = {
    holdingId: "1",
    companyId: "11",
    branchId: null,
    businessUnitId: null,
  };
  const branch = {
    holdingId: "1",
    companyId: "11",
    branchId: "21",
    businessUnitId: null,
  };
  const unitInBranch = {
    holdingId: "1",
    companyId: "11",
    branchId: "21",
    businessUnitId: "31",
  };
  const otherUnit = {
    holdingId: "1",
    companyId: "11",
    branchId: "22",
    businessUnitId: "32",
  };
  assert.equal(
    scopeContainsScope("holding", "company", holding, company),
    true,
  );
  assert.equal(
    scopeContainsScope("company", "businessUnit", company, unitInBranch),
    true,
  );
  assert.equal(
    scopeContainsScope("branch", "businessUnit", branch, unitInBranch),
    true,
  );
  assert.equal(
    scopeContainsScope("branch", "businessUnit", branch, otherUnit),
    false,
  );
  assert.equal(
    scopeContainsScope("company", "holding", company, holding),
    false,
  );
  assert.equal(
    scopeContainsScope("businessUnit", "company", unitInBranch, company),
    false,
  );
});

test("own and assigned permissions cannot be re-delegated", () => {
  const own = {
    holdingId: "1",
    companyId: "11",
    branchId: null,
    businessUnitId: null,
  };
  const target = {
    holdingId: "1",
    companyId: "11",
    branchId: null,
    businessUnitId: null,
  };
  assert.equal(scopeContainsScope("own", "own", own, target), false);
  assert.equal(scopeContainsScope("assigned", "assigned", own, target), false);
});

test("branch and business-unit managers cannot enumerate broader or neighboring memberships", () => {
  const branch = {
    holdingId: "1",
    companyId: "11",
    branchId: "21",
    businessUnitId: null,
  };
  const sameBranch = {
    holdingId: "1",
    companyId: "11",
    branchId: "21",
    businessUnitId: null,
  };
  const otherBranch = {
    holdingId: "1",
    companyId: "11",
    branchId: "22",
    businessUnitId: null,
  };
  const company = {
    holdingId: "1",
    companyId: "11",
    branchId: null,
    businessUnitId: null,
  };
  const unit = {
    holdingId: "1",
    companyId: "11",
    branchId: "21",
    businessUnitId: "31",
  };
  assert.equal(
    scopeContainsScope("branch", "branch", branch, sameBranch),
    true,
  );
  assert.equal(
    scopeContainsScope("branch", "branch", branch, otherBranch),
    false,
  );
  assert.equal(scopeContainsScope("branch", "company", branch, company), false);
  assert.equal(
    scopeContainsScope("businessUnit", "businessUnit", unit, unit),
    true,
  );
  assert.equal(
    scopeContainsScope("businessUnit", "branch", unit, branch),
    false,
  );
});

test("root, system, and TECHNICAL_ADMIN roles are never delegable", () => {
  assert.equal(
    isDelegableRole({ key: "TECHNICAL_ADMIN", isSystem: false }),
    false,
  );
  assert.equal(
    isDelegableRole({ key: "CUSTOM_ROOT_OPERATOR", isSystem: false }),
    false,
  );
  assert.equal(
    isDelegableRole({ key: "CUSTOM_SYSTEM_OPERATOR", isSystem: false }),
    false,
  );
  assert.equal(
    isDelegableRole({ key: "CUSTOM_MANAGER", isSystem: true }),
    false,
  );
  assert.equal(
    isDelegableRole({ key: "CUSTOM_MANAGER", isSystem: false }),
    true,
  );
});

test("COMPANY_ADMIN is an operational delegable role without infrastructure grants", () => {
  assert.equal(
    isDelegableRole({ key: "COMPANY_ADMIN", isSystem: false }),
    true,
  );
  assert.ok(SMART_MANAGER_COMPANY_ADMIN_GRANTS.includes("users.manage"));
  assert.ok(SMART_MANAGER_COMPANY_ADMIN_GRANTS.includes("unit.manage"));
  assert.ok(SMART_MANAGER_COMPANY_ADMIN_GRANTS.includes("action.approve"));
  assert.equal(
    SMART_MANAGER_COMPANY_ADMIN_GRANTS.includes("permissions.manage"),
    false,
  );
  assert.equal(
    SMART_MANAGER_COMPANY_ADMIN_GRANTS.includes("integration.manage"),
    false,
  );
});
