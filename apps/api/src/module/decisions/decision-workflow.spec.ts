import assert from "node:assert/strict";
import test from "node:test";
import {
  canApproveDecision,
  canTransitionDecision,
  isOverdueDecision,
} from "./decision-workflow.js";

test("decision approval requires a different authorized user and a pending decision", () => {
  assert.equal(
    canApproveDecision({
      status: "pending_approval",
      createdBy: 10n,
      actorId: 11n,
    }),
    true,
  );
  assert.equal(
    canApproveDecision({
      status: "pending_approval",
      createdBy: 10n,
      actorId: 10n,
    }),
    false,
  );
  assert.equal(
    canApproveDecision({ status: "approved", createdBy: 10n, actorId: 11n }),
    false,
  );
});

test("decision outcome follows approval and evidence closure workflow", () => {
  assert.equal(canTransitionDecision("pending_approval", "rejected"), true);
  assert.equal(canTransitionDecision("approved", "in_progress"), true);
  assert.equal(canTransitionDecision("in_progress", "resolved"), true);
  assert.equal(canTransitionDecision("resolved", "closed"), true);
  assert.equal(canTransitionDecision("pending_approval", "closed"), false);
});

test("only approved open decisions past deadline are overdue", () => {
  assert.equal(
    isOverdueDecision({
      status: "approved",
      deadline: "2020-01-01",
      today: "2026-10-09",
    }),
    true,
  );
  assert.equal(
    isOverdueDecision({
      status: "in_progress",
      deadline: "2026-10-10",
      today: "2026-10-09",
    }),
    false,
  );
  assert.equal(
    isOverdueDecision({
      status: "resolved",
      deadline: "2020-01-01",
      today: "2026-10-09",
    }),
    false,
  );
});
