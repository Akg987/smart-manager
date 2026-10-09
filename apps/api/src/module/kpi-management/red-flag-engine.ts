export type RedFlagTrigger =
  | "kpi_below_threshold"
  | "kpi_above_threshold"
  | "multiple_period_degradation"
  | "data_missing"
  | "data_stale"
  | "action_overdue"
  | "decision_overdue";
export type RedFlagRuleInput = {
  trigger: string;
  configuration?: Record<string, unknown> | null;
};

export function matchesRedFlagRule(
  rule: RedFlagRuleInput,
  context: {
    actual: number | null;
    threshold: number | null;
    direction: "higher" | "lower" | "range";
    history?: number[];
    dataState?: string;
    actionOverdue?: boolean;
    decisionOverdue?: boolean;
  },
) {
  const config = rule.configuration ?? {};
  const configuredThreshold =
    typeof config.threshold === "number" ? config.threshold : context.threshold;
  switch (rule.trigger as RedFlagTrigger) {
    case "kpi_below_threshold":
      return (
        context.actual !== null &&
        configuredThreshold !== null &&
        context.actual < configuredThreshold
      );
    case "kpi_above_threshold":
      return (
        context.actual !== null &&
        configuredThreshold !== null &&
        context.actual > configuredThreshold
      );
    case "data_missing":
      return context.dataState === "missing" || context.dataState === "null";
    case "data_stale":
      return context.dataState === "stale";
    case "action_overdue":
      return context.actionOverdue === true;
    case "decision_overdue":
      return context.decisionOverdue === true;
    case "multiple_period_degradation": {
      const periods =
        Number.isInteger(config.periods) && Number(config.periods) >= 2
          ? Number(config.periods)
          : 3;
      const values = context.history ?? [];
      if (values.length < periods) return false;
      const sample = values.slice(0, periods);
      const monotonicallyDegrading = sample.every(
        (value, index) =>
          index === 0 ||
          (context.direction === "lower"
            ? sample[index - 1] >= value
            : sample[index - 1] <= value),
      );
      const minimumChange =
        typeof config.minimumChangePercent === "number"
          ? Math.max(0, config.minimumChangePercent)
          : 0;
      const first = sample[0];
      const last = sample.at(-1)!;
      const changePercent =
        Math.abs(first) < Number.EPSILON
          ? 0
          : Math.abs((last - first) / first) * 100;
      return monotonicallyDegrading && changePercent >= minimumChange;
    }
    default:
      return false;
  }
}
