import assert from "node:assert/strict";
import test from "node:test";
import { AuthContextStore } from "./auth-context.store.js";

const context = {
  userId: "7",
  holdingId: "1",
  membershipId: "9",
  companyId: "11",
  branchId: null,
  businessUnitId: null,
  roleIds: ["4"],
  scopeType: "company",
};

test("request auth context is isolated and rejects another user id", async () => {
  const store = new AuthContextStore();
  await store.run(context, async () => {
    assert.equal(store.current()?.membershipId, "9");
    assert.equal(store.current("8"), null);
    await Promise.resolve();
    assert.equal(store.current("7")?.companyId, "11");
  });
  assert.equal(store.current(), null);
});
