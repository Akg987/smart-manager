import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthService } from "./auth.service.js";

const context = {
  userId: "7",
  holdingId: "1",
  membershipId: "12",
  companyId: "3",
  branchId: null,
  businessUnitId: null,
  roleIds: ["4"],
  scopeType: "company",
};

test("effective permissions include grants for the active tenant and self scope", async () => {
  const service = new AuthService(
    {
      effectivePermissionGrants: async () => [
        { permission: "kpi.view", scopeType: "company", domain: null },
        { permission: "action.update-own", scopeType: "own", domain: null },
      ],
    } as never,
    {} as never,
  );

  assert.deepEqual(await service.effectivePermissions(context), [
    "kpi.view",
    "action.update-own",
  ]);
});

test("effective permissions omit grants outside the active business-unit scope", async () => {
  const service = new AuthService(
    {
      effectivePermissionGrants: async () => [
        { permission: "kpi.view", scopeType: "businessUnit", domain: null },
      ],
    } as never,
    {} as never,
  );

  assert.deepEqual(await service.effectivePermissions(context), []);
});
