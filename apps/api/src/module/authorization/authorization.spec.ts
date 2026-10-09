import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalTenantPermission,
  canonicalPermission,
  knownPermissions,
} from "./authorization.service.js";

test("Laravel capability aliases resolve to registered capability keys", () => {
  assert.equal(canonicalPermission("organization.manage"), "company.manage");
  assert.equal(
    canonicalPermission("users.assign-organization"),
    "users.manage",
  );
  assert.equal(
    canonicalPermission("sms.manage-settings"),
    "integration.manage",
  );
  assert.equal(canonicalPermission(" ACTIONS.Manage "), "actions.manage");
});

test("the grant catalog contains registered Laravel and module capabilities only", () => {
  assert.ok((knownPermissions as readonly string[]).includes("manage-roles"));
  assert.ok((knownPermissions as readonly string[]).includes("kpi.submit"));
  assert.ok((knownPermissions as readonly string[]).includes("alerts.resolve"));
  assert.ok(
    !(knownPermissions as readonly string[]).includes("organization.manage"),
  );
});

test("legacy action and KPI management grants keep distinct permission keys", () => {
  assert.equal(canonicalTenantPermission("actions.manage"), "action.manage");
  assert.equal(
    canonicalTenantPermission("actions.update-own"),
    "action.update-own",
  );
  assert.equal(canonicalTenantPermission("kpi.manage"), "kpi.manage");
  assert.notEqual(
    canonicalTenantPermission("actions.manage"),
    canonicalTenantPermission("actions.update-own"),
  );
});
