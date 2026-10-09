import type { ActionStatus } from "../../../../../src/db/schema.js";

export function canTransitionAction(input: {
  current: ActionStatus;
  next: ActionStatus;
  actorId: bigint;
  ownerUserId: bigint;
  approverUserId: bigint | null;
  progress: number;
  canUpdateOwn: boolean;
  canManage: boolean;
  canApprove: boolean;
}): boolean {
  const designatedApprover = input.actorId === input.approverUserId;
  const mayApprove = input.canApprove || input.canManage;
  const executorCanUpdate =
    input.canManage ||
    (input.canUpdateOwn && input.actorId === input.ownerUserId);
  const authorizedApprover =
    mayApprove &&
    input.actorId !== input.ownerUserId &&
    (designatedApprover || input.canManage);

  if (input.next === "approved")
    return authorizedApprover && ["proposed", "open"].includes(input.current);
  if (input.next === "closed")
    return (
      authorizedApprover &&
      input.current === "pending_completion_approval" &&
      input.progress === 100
    );
  if (input.next === "canceled")
    return (
      authorizedApprover &&
      !["closed", "done", "canceled"].includes(input.current)
    );
  if (
    input.next === "in_progress" &&
    input.current === "pending_completion_approval"
  )
    return authorizedApprover;
  if (["in_progress", "blocked"].includes(input.next))
    return (
      executorCanUpdate &&
      ["approved", "in_progress", "blocked"].includes(input.current)
    );
  if (input.next === "pending_completion_approval")
    return (
      executorCanUpdate &&
      ["approved", "in_progress", "blocked"].includes(input.current) &&
      input.progress === 100
    );
  return false;
}
