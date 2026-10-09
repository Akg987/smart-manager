import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateAchievement,
  calculateKpiHealth,
  calculateKpiInput,
  classifyMissingState,
  KpiCalculationError,
  validateReportedUnit,
} from "./kpi-calculation.js";

test("higher, lower, and custom range calculations are centralized", () => {
  assert.equal(
    calculateAchievement({ actual: 80, target: 100, direction: "higher" }),
    80,
  );
  assert.equal(
    calculateAchievement({ actual: 50, target: 100, direction: "lower" }),
    200,
  );
  assert.equal(
    calculateAchievement({ actual: 0, target: 100, direction: "lower" }),
    null,
  );
  assert.equal(
    calculateAchievement({
      actual: 5,
      target: 10,
      direction: "range",
      range: { minimum: 4, maximum: 6 },
    }),
    100,
  );
  assert.equal(
    calculateAchievement({
      actual: 8,
      target: 10,
      direction: "range",
      range: { minimum: 4, maximum: 6 },
    }),
    50,
  );
  assert.throws(
    () => calculateAchievement({ actual: 5, target: 10, direction: "range" }),
    KpiCalculationError,
  );
});

test("missing, null, zero, stale, and late states remain distinct", () => {
  assert.equal(
    calculateKpiInput({ inputMode: "numeric" }).dataState,
    "missing",
  );
  assert.equal(
    calculateKpiInput({ inputMode: "numeric", actualValue: null }).dataState,
    "null",
  );
  assert.equal(
    calculateKpiInput({ inputMode: "numeric", actualValue: 0 }).dataState,
    "zero",
  );
  assert.equal(classifyMissingState("stale"), "gray");
  assert.equal(classifyMissingState("late"), "gray");
  assert.equal(classifyMissingState("valid"), "known");
});

test("ratio, percentage, formula, text, and select inputs validate values", () => {
  assert.equal(
    calculateKpiInput({
      inputMode: "ratio",
      data: { numerator: 3, denominator: 4 },
    }).numericValue,
    0.75,
  );
  assert.equal(
    calculateKpiInput({
      inputMode: "percentage",
      data: { numerator: 3, denominator: 4 },
    }).numericValue,
    75,
  );
  assert.throws(
    () =>
      calculateKpiInput({
        inputMode: "ratio",
        data: { numerator: 3, denominator: 0 },
      }),
    (error) =>
      error instanceof KpiCalculationError && error.code === "division_by_zero",
  );
  assert.equal(
    calculateKpiInput({
      inputMode: "formula",
      formulaType: "average",
      data: { values: [2, 4] },
    }).numericValue,
    3,
  );
  assert.equal(
    calculateKpiInput({ inputMode: "textarea", data: { actual: "متن توضیحی" } })
      .value,
    "متن توضیحی",
  );
  assert.equal(
    calculateKpiInput({
      inputMode: "select",
      inputOptions: ["A", "B"],
      data: { actual: "B" },
    }).value,
    "B",
  );
  assert.deepEqual(
    calculateKpiInput({
      inputMode: "multi-select",
      inputOptions: ["A", "B"],
      data: { actual: ["A", "B"] },
    }).value,
    ["A", "B"],
  );
  assert.throws(
    () => calculateKpiInput({ inputMode: "count", actualValue: 1.5 }),
    KpiCalculationError,
  );
});

test("health is independent of missing-data and red-flag severity", () => {
  assert.equal(
    calculateKpiHealth({
      actual: 0,
      target: 100,
      direction: "higher",
      warning: 85,
      critical: 70,
    }),
    "red",
  );
  assert.equal(
    calculateKpiHealth({
      actual: null,
      target: 100,
      direction: "higher",
      warning: 85,
      critical: 70,
    }),
    "unknown",
  );
  assert.throws(
    () =>
      calculateKpiHealth({
        actual: 80,
        target: -1,
        direction: "higher",
        warning: 0,
        critical: -1,
      }),
    KpiCalculationError,
  );
});

test("wrong reported units are rejected before approval", () => {
  validateReportedUnit("kg", "kg");
  assert.throws(
    () => validateReportedUnit("kg", "USD"),
    (error) =>
      error instanceof KpiCalculationError &&
      error.code === "incompatible_unit",
  );
});
