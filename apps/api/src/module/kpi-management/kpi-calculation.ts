import type { KpiDirection, KpiHealth } from "../../../../../src/db/schema.js";

export const KPI_INPUT_MODES = [
  "numeric",
  "percentage",
  "currency",
  "count",
  "ratio",
  "text",
  "textarea",
  "select",
  "multi-select",
  "formula",
  "descriptive",
  "direct",
  "checklist",
  "components",
] as const;

export type KpiInputMode = (typeof KPI_INPUT_MODES)[number];
export type KpiValueState = "valid" | "zero" | "null" | "missing";
export type KpiCalculationResult = {
  value: unknown;
  numericValue: number | null;
  dataState: KpiValueState;
};

export class KpiCalculationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unsupported_input_mode"
      | "invalid_value"
      | "division_by_zero"
      | "invalid_formula"
      | "invalid_range"
      | "incompatible_unit",
  ) {
    super(message);
    this.name = "KpiCalculationError";
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function result(
  value: unknown,
  numericValue: number | null,
): KpiCalculationResult {
  return {
    value,
    numericValue,
    dataState:
      value === undefined
        ? "missing"
        : value === null
          ? "null"
          : numericValue === 0
            ? "zero"
            : "valid",
  };
}

export function calculateKpiInput(input: {
  inputMode: string;
  actualValue?: unknown;
  data?: Record<string, unknown>;
  inputOptions?: string[];
  formulaType?: string;
}): KpiCalculationResult {
  const data = input.data ?? {};
  const hasValue =
    Object.hasOwn(data, "actual") || Object.hasOwn(data, "value");
  const supplied = Object.hasOwn(data, "actual")
    ? data.actual
    : Object.hasOwn(data, "value")
      ? data.value
      : input.actualValue;
  const mode = input.inputMode;

  if (mode === "text" || mode === "textarea" || mode === "descriptive") {
    if (supplied === undefined && !hasValue) return result(undefined, null);
    if (supplied === null) return result(null, null);
    if (typeof supplied !== "string")
      throw new KpiCalculationError(
        "A text value is required.",
        "invalid_value",
      );
    const value = supplied.trim();
    if (!value)
      throw new KpiCalculationError(
        "A non-empty text value is required.",
        "invalid_value",
      );
    const maxLength =
      mode === "descriptive" || mode === "textarea" ? 5000 : 500;
    if (value.length > maxLength)
      throw new KpiCalculationError(
        "The text value exceeds its allowed length.",
        "invalid_value",
      );
    return result(value, null);
  }

  if (mode === "select") {
    if (supplied === undefined && !hasValue) return result(undefined, null);
    if (supplied === null) return result(null, null);
    if (typeof supplied !== "string" || !supplied.trim())
      throw new KpiCalculationError(
        "A selection is required.",
        "invalid_value",
      );
    if (input.inputOptions?.length && !input.inputOptions.includes(supplied))
      throw new KpiCalculationError(
        "The selected value is not an available option.",
        "invalid_value",
      );
    return result(supplied, null);
  }

  if (mode === "multi-select") {
    if (supplied === undefined && !hasValue) return result(undefined, null);
    if (supplied === null) return result(null, null);
    if (
      !Array.isArray(supplied) ||
      supplied.length === 0 ||
      !supplied.every((value) => typeof value === "string")
    )
      throw new KpiCalculationError(
        "Select at least one valid option.",
        "invalid_value",
      );
    if (
      input.inputOptions?.length &&
      supplied.some((value) => !input.inputOptions?.includes(value))
    )
      throw new KpiCalculationError(
        "A selected value is not an available option.",
        "invalid_value",
      );
    return result([...new Set(supplied)], null);
  }

  let value: number | null;
  if (mode === "ratio" || mode === "percentage") {
    const numerator = data.numerator;
    const denominator = data.denominator;
    if (
      numerator === undefined &&
      denominator === undefined &&
      isFiniteNumber(supplied)
    ) {
      value = supplied;
    } else {
      if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator))
        throw new KpiCalculationError(
          "A valid numerator and denominator are required.",
          "invalid_value",
        );
      if (denominator === 0)
        throw new KpiCalculationError(
          "The denominator cannot be zero.",
          "division_by_zero",
        );
      value = numerator / denominator;
      if (mode === "percentage") value *= 100;
    }
  } else if (mode === "checklist") {
    const completed = data.completed;
    const total = data.total;
    if (
      !isFiniteNumber(completed) ||
      !Number.isInteger(completed) ||
      completed < 0 ||
      !isFiniteNumber(total) ||
      !Number.isInteger(total) ||
      total <= 0 ||
      completed > total
    )
      throw new KpiCalculationError(
        "Completed items must be between zero and the total.",
        "invalid_value",
      );
    value = (completed / total) * 100;
  } else if (mode === "formula" || mode === "components") {
    const values = data.values;
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      !values.every(isFiniteNumber)
    )
      throw new KpiCalculationError(
        "Formula inputs must be a non-empty list of finite numbers.",
        "invalid_formula",
      );
    const operation = input.formulaType ?? "sum";
    if (operation === "sum")
      value = values.reduce((sum, item) => sum + item, 0);
    else if (operation === "average")
      value = values.reduce((sum, item) => sum + item, 0) / values.length;
    else if (operation === "product")
      value = values.reduce((product, item) => product * item, 1);
    else if (operation === "difference" && values.length === 2)
      value = values[0] - values[1];
    else if (
      (operation === "ratio" || operation === "percentage") &&
      values.length === 2
    ) {
      if (values[1] === 0)
        throw new KpiCalculationError(
          "The formula denominator cannot be zero.",
          "division_by_zero",
        );
      value = (values[0] / values[1]) * (operation === "percentage" ? 100 : 1);
    } else {
      throw new KpiCalculationError(
        "The formula operation or its inputs are invalid.",
        "invalid_formula",
      );
    }
  } else if (
    mode === "direct" ||
    mode === "numeric" ||
    mode === "count" ||
    mode === "currency"
  ) {
    if (supplied === undefined && !hasValue) return result(undefined, null);
    if (supplied === null) return result(null, null);
    if (!isFiniteNumber(supplied))
      throw new KpiCalculationError(
        "A finite numeric value is required.",
        "invalid_value",
      );
    if (mode === "count" && (!Number.isInteger(supplied) || supplied < 0))
      throw new KpiCalculationError(
        "A count must be a non-negative whole number.",
        "invalid_value",
      );
    value = supplied;
  } else {
    throw new KpiCalculationError(
      `Unsupported KPI input mode: ${mode}.`,
      "unsupported_input_mode",
    );
  }

  if (!Number.isFinite(value))
    throw new KpiCalculationError(
      "The calculated value is not finite.",
      "invalid_formula",
    );
  return result(value, value);
}

export function calculateAchievement(input: {
  actual: number | null;
  target: number;
  direction: KpiDirection;
  range?: { minimum: number; maximum: number } | null;
}): number | null {
  const { actual, target, direction, range } = input;
  if (actual === null || !Number.isFinite(actual)) return null;
  if (!Number.isFinite(target) || target <= 0)
    throw new KpiCalculationError(
      "The KPI target must be greater than zero.",
      "invalid_value",
    );
  if (direction === "higher") return (actual / target) * 100;
  if (direction === "lower") {
    if (actual === 0) return null;
    return (target / actual) * 100;
  }
  if (
    !range ||
    !Number.isFinite(range.minimum) ||
    !Number.isFinite(range.maximum) ||
    range.minimum > range.maximum
  )
    throw new KpiCalculationError(
      "A valid custom range is required.",
      "invalid_range",
    );
  if (actual >= range.minimum && actual <= range.maximum) return 100;
  const width = range.maximum - range.minimum;
  const scale =
    width > 0
      ? width
      : Math.max(Math.abs(range.minimum), Math.abs(range.maximum), 1);
  const distance =
    actual < range.minimum ? range.minimum - actual : actual - range.maximum;
  return Math.max(0, 100 - (distance / (scale * 2)) * 100);
}

export function calculateKpiHealth(input: {
  actual: number | null;
  target: number;
  direction: KpiDirection;
  warning: number | null;
  critical: number | null;
  range?: { minimum: number; maximum: number } | null;
}): KpiHealth {
  const { actual, target, direction, warning, critical, range } = input;
  if (actual === null || !Number.isFinite(actual)) return "unknown";
  if (!Number.isFinite(target) || target <= 0)
    throw new KpiCalculationError(
      "The KPI target must be greater than zero.",
      "invalid_value",
    );
  if (direction === "range") {
    if (
      !range ||
      !Number.isFinite(range.minimum) ||
      !Number.isFinite(range.maximum) ||
      range.minimum > range.maximum
    )
      throw new KpiCalculationError(
        "A valid custom range is required.",
        "invalid_range",
      );
    const warningBand = Math.abs(warning ?? 0);
    const criticalBand = Math.abs(critical ?? 0);
    if (criticalBand < warningBand)
      throw new KpiCalculationError(
        "The critical range must include the warning range.",
        "invalid_range",
      );
    const distance =
      actual < range.minimum
        ? range.minimum - actual
        : actual > range.maximum
          ? actual - range.maximum
          : 0;
    return distance <= warningBand
      ? "green"
      : distance <= criticalBand
        ? "yellow"
        : "red";
  }
  if (warning === null || critical === null)
    throw new KpiCalculationError(
      "Warning and critical thresholds are required.",
      "invalid_value",
    );
  const invalid =
    direction === "higher" ? critical > warning : critical < warning;
  if (invalid)
    throw new KpiCalculationError(
      "Critical and warning thresholds are inconsistent.",
      "invalid_range",
    );
  if (direction === "higher")
    return actual >= warning ? "green" : actual >= critical ? "yellow" : "red";
  return actual <= warning ? "green" : actual <= critical ? "yellow" : "red";
}

export function validateReportedUnit(expected: string, actual?: string | null) {
  if (
    actual != null &&
    actual.trim() &&
    expected.trim().toLocaleLowerCase() !== actual.trim().toLocaleLowerCase()
  )
    throw new KpiCalculationError(
      "The submitted unit does not match the KPI unit.",
      "incompatible_unit",
    );
}

export function classifyMissingState(state: string): "gray" | "known" {
  return ["missing", "stale", "late", "null"].includes(state)
    ? "gray"
    : "known";
}
