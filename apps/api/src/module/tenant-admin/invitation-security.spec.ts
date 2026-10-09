import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hashInvitationToken,
  invitationSnapshotAllowsCurrentGrants,
} from "./invitation-security.js";

test("invitation tokens are stored as a one-way hash", () => {
  const token = "a-secure-one-time-invitation-token";
  const hash = hashInvitationToken(token);
  assert.equal(hash, hashInvitationToken(token));
  assert.notEqual(hash, token);
  assert.equal(hash.length, 64);
});

test("invitation role snapshots allow unchanged or reduced grants and reject expansion", () => {
  const snapshot = [
    { key: "users.view", scopeType: "company", domain: null },
    { key: "kpi.view", scopeType: "company", domain: null },
  ];
  assert.equal(invitationSnapshotAllowsCurrentGrants(snapshot, snapshot), true);
  assert.equal(
    invitationSnapshotAllowsCurrentGrants(snapshot, [snapshot[0]!]),
    true,
  );
  assert.equal(
    invitationSnapshotAllowsCurrentGrants(snapshot, [
      ...snapshot,
      { key: "users.manage", scopeType: "company", domain: null },
    ]),
    false,
  );
  assert.equal(
    invitationSnapshotAllowsCurrentGrants(snapshot, [
      { key: "kpi.view", scopeType: "holding", domain: null },
    ]),
    false,
  );
  assert.equal(invitationSnapshotAllowsCurrentGrants(null, []), false);
});
