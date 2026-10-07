import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalPermission,
  knownPermissions,
} from "./authorization.service.js";

test("Laravel capability aliases resolve to registered capability keys", () => {
  assert.equal(
    canonicalPermission("organization.manage"),
    "manage-departments",
  );
  assert.equal(
    canonicalPermission("users.assign-organization"),
    "manage-users",
  );
  assert.equal(canonicalPermission("sms.manage-settings"), "manage-settings");
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
