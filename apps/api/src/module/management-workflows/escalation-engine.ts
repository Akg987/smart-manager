export type EscalationTrigger =
  | "severity"
  | "amount"
  | "duration"
  | "delay"
  | "missing_data"
  | "no_response";
export type EscalationTarget = {
  type: "red_flag" | "action" | "decision" | "kpi";
  status: string;
  severity?: string | null;
  amount?: number | null;
  createdAt?: Date | null;
  deadline?: Date | null;
  lastRespondedAt?: Date | null;
  missing?: boolean;
};

const severityScore: Readonly<Record<string, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
  critical: 4,
};
const finalStatuses = new Set([
  "closed",
  "cancelled",
  "canceled",
  "resolved",
  "rejected",
  "done",
]);

export function matchesEscalation(input: {
  trigger: EscalationTrigger;
  configuration: Record<string, unknown>;
  target: EscalationTarget;
  now?: Date;
}): boolean {
  const { trigger, configuration, target } = input;
  const now = input.now ?? new Date();
  if (finalStatuses.has(target.status)) return false;
  if (trigger === "severity") {
    const minimum =
      typeof configuration.minimumSeverity === "string"
        ? configuration.minimumSeverity
        : "high";
    return (
      (severityScore[target.severity ?? ""] ?? 0) >=
      (severityScore[minimum] ?? Number.POSITIVE_INFINITY)
    );
  }
  if (trigger === "amount") {
    const threshold = Number(configuration.minimumAmount);
    return (
      Number.isFinite(threshold) &&
      target.amount !== null &&
      target.amount !== undefined &&
      target.amount >= threshold
    );
  }
  if (trigger === "duration") {
    const minutes = Number(configuration.minutes);
    return (
      Number.isFinite(minutes) &&
      minutes >= 0 &&
      !!target.createdAt &&
      now.getTime() - target.createdAt.getTime() >= minutes * 60_000
    );
  }
  if (trigger === "delay")
    return !!target.deadline && target.deadline.getTime() < now.getTime();
  if (trigger === "missing_data")
    return target.type === "kpi" && target.missing === true;
  const minutes = Number(configuration.minutes);
  return (
    Number.isFinite(minutes) &&
    minutes >= 0 &&
    !!target.lastRespondedAt &&
    now.getTime() - target.lastRespondedAt.getTime() >= minutes * 60_000
  );
}

export function reminderSchedule(dueAt: Date, offsetsMinutes: number[]) {
  return offsetsMinutes.map((offset) => ({
    offsetMinutes: offset,
    phase:
      offset < 0
        ? ("before" as const)
        : offset === 0
          ? ("on" as const)
          : ("after" as const),
    scheduledFor: new Date(dueAt.getTime() + offset * 60_000),
  }));
}
