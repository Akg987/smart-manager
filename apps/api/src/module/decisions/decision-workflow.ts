export type DecisionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "communicated"
  | "in_progress"
  | "result_review"
  | "resolved"
  | "closed"
  | "rejected"
  | "cancelled";

const transitions: Readonly<Record<DecisionStatus, readonly DecisionStatus[]>> =
  {
    draft: ["approved", "cancelled"],
    pending_approval: ["approved", "rejected", "cancelled"],
    approved: ["communicated", "in_progress", "cancelled"],
    communicated: ["in_progress", "cancelled"],
    in_progress: ["result_review", "resolved", "cancelled"],
    result_review: ["closed", "in_progress"],
    resolved: ["closed"],
    closed: [],
    rejected: [],
    cancelled: [],
  };

export function canApproveDecision(input: {
  status: DecisionStatus;
  createdBy: bigint | null;
  actorId: bigint;
}) {
  return (
    (input.status === "draft" || input.status === "pending_approval") &&
    input.createdBy !== input.actorId
  );
}

export function canTransitionDecision(
  current: DecisionStatus,
  next: DecisionStatus,
) {
  return transitions[current].includes(next);
}

export function isOverdueDecision(input: {
  status: DecisionStatus;
  deadline: string;
  today: string;
}) {
  return (
    (
      [
        "approved",
        "communicated",
        "in_progress",
        "result_review",
      ] as DecisionStatus[]
    ).includes(input.status) && input.deadline < input.today
  );
}
