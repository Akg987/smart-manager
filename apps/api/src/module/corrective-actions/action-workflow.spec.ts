import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionAction } from "./action-workflow.js";

const base = {
  current: "in_progress" as const,
  actorId: 7n,
  ownerUserId: 7n,
  approverUserId: 9n,
  progress: 100,
  canUpdateOwn: true,
  canManage: false,
  canApprove: false,
};

test("executor may submit 100 percent work for final approval", () => {
  assert.equal(
    canTransitionAction({ ...base, next: "pending_completion_approval" }),
    true,
  );
});

test("executor cannot approve or close their own action", () => {
  assert.equal(canTransitionAction({ ...base, next: "closed" }), false);
  assert.equal(canTransitionAction({ ...base, next: "approved" }), false);
});

test("100 percent alone does not close an action", () => {
  assert.equal(
    canTransitionAction({
      ...base,
      current: "in_progress",
      next: "closed",
      actorId: 9n,
      ownerUserId: 7n,
      canUpdateOwn: false,
      canApprove: true,
    }),
    false,
  );
});

test("assigned approver closes only after completion is submitted", () => {
  const approval = {
    ...base,
    current: "pending_completion_approval" as const,
    next: "closed" as const,
    actorId: 9n,
    ownerUserId: 7n,
    canUpdateOwn: false,
    canApprove: true,
  };
  assert.equal(canTransitionAction({ ...approval, progress: 99 }), false);
  assert.equal(canTransitionAction(approval), true);
});

test("update-own cannot cancel or change an action owned by another user", () => {
  assert.equal(canTransitionAction({ ...base, next: "canceled" }), false);
  assert.equal(
    canTransitionAction({
      ...base,
      next: "blocked",
      ownerUserId: 8n,
      canUpdateOwn: false,
    }),
    false,
  );
});

test("an assigned approver with update-own cannot act as the executor", () => {
  assert.equal(
    canTransitionAction({
      ...base,
      actorId: 9n,
      canUpdateOwn: true,
      next: "pending_completion_approval",
    }),
    false,
  );
});
