import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  assertAcyclicFormula,
  evaluateFormula,
  parseFormula,
  validateFormula,
} from "./formula-engine.js";

const metrics = [
  {
    id: "1",
    code: "average-basket",
    companyId: "10",
    unit: "IRR",
    periodType: "monthly",
    status: "published",
    actual: 12_000,
    previousActual: 10_000,
  },
  {
    id: "2",
    code: "purchase_count",
    companyId: "10",
    unit: "count",
    periodType: "monthly",
    status: "published",
    actual: 4,
  },
  {
    id: "3",
    code: "customer_count",
    companyId: "10",
    unit: "count",
    periodType: "monthly",
    status: "published",
    actual: 20,
  },
];

test("parses formula strings into a precedence aware AST without eval", () => {
  assert.deepEqual(
    parseFormula("{average-basket} * {purchase_count}", metrics),
    {
      type: "binary",
      operator: "*",
      left: { type: "kpi", id: "1" },
      right: { type: "kpi", id: "2" },
    },
  );
  assert.equal(parseFormula("1 + 2 * 3", metrics).type, "binary");
  assert.throws(
    () => parseFormula("process.exit()", metrics),
    BadRequestException,
  );
  assert.throws(
    () => parseFormula("{missing_kpi} / 2", metrics),
    /does not exist or is not accessible/,
  );
});

test("calculates arithmetic, supported aggregate functions, ratios, change and growth", () => {
  const values = new Map(metrics.map((metric) => [metric.id, metric]));
  assert.equal(
    evaluateFormula(
      parseFormula("{average-basket} * {purchase_count}", metrics),
      values,
    ),
    48_000,
  );
  assert.equal(
    evaluateFormula(parseFormula("AVG({purchase_count}, 6)", metrics), values),
    5,
  );
  assert.equal(
    evaluateFormula(
      parseFormula("RATIO({customer_count}, {purchase_count})", metrics),
      values,
    ),
    5,
  );
  assert.equal(
    evaluateFormula(parseFormula("CHANGE({average-basket})", metrics), values),
    2_000,
  );
  assert.equal(
    evaluateFormula(parseFormula("GROWTH({average-basket})", metrics), values),
    20,
  );
});

test("rejects incompatible units, periods, tenants, missing values and division by zero", () => {
  const ast = parseFormula("{average-basket} + {purchase_count}", metrics);
  assert.throws(
    () =>
      validateFormula({
        ast,
        metrics,
        companyId: "10",
        expectedUnit: "IRR",
        expectedPeriodType: "monthly",
      }),
    /matching KPI units/,
  );
  assert.throws(
    () =>
      validateFormula({
        ast: parseFormula("{average-basket}", metrics),
        metrics: [{ ...metrics[0], companyId: "11" }],
        companyId: "10",
        expectedUnit: "IRR",
        expectedPeriodType: "monthly",
      }),
    /active Company/,
  );
  assert.throws(
    () =>
      validateFormula({
        ast: parseFormula("{average-basket}", metrics),
        metrics: [{ ...metrics[0], periodType: "weekly" }],
        companyId: "10",
        expectedUnit: "IRR",
        expectedPeriodType: "monthly",
      }),
    /compatible reporting periods/,
  );
  assert.throws(
    () =>
      evaluateFormula(
        parseFormula("{customer_count} / 0", metrics),
        new Map(metrics.map((metric) => [metric.id, metric])),
      ),
    /divide by zero/,
  );
  assert.throws(
    () => evaluateFormula(parseFormula("{purchase_count}", metrics), new Map()),
    /no valid actual/,
  );
});

test("detects a circular dependency when publishing a derived KPI", () => {
  const ast = { type: "kpi", id: "derived-1" } as const;
  assert.throws(
    () => assertAcyclicFormula("derived-1", ast, new Map()),
    /circular/,
  );
  assert.doesNotThrow(() =>
    assertAcyclicFormula(
      "derived-1",
      { type: "kpi", id: "base-1" },
      new Map([["base-1", ["base-2"]]]),
    ),
  );
});
