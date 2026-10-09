import assert from "node:assert/strict";
import test from "node:test";
import { matchesRedFlagRule } from "./red-flag-engine.js";

test("red flag rules evaluate configured threshold, data and overdue triggers", () => {
  assert.equal(
    matchesRedFlagRule(
      { trigger: "kpi_below_threshold", configuration: { threshold: 80 } },
      { actual: 79, threshold: 70, direction: "higher" },
    ),
    true,
  );
  assert.equal(
    matchesRedFlagRule(
      { trigger: "kpi_above_threshold" },
      { actual: 4, threshold: 3, direction: "lower" },
    ),
    true,
  );
  assert.equal(
    matchesRedFlagRule(
      { trigger: "data_missing" },
      {
        actual: null,
        threshold: null,
        direction: "higher",
        dataState: "missing",
      },
    ),
    true,
  );
  assert.equal(
    matchesRedFlagRule(
      { trigger: "data_stale" },
      { actual: 1, threshold: null, direction: "higher", dataState: "stale" },
    ),
    true,
  );
  assert.equal(
    matchesRedFlagRule(
      { trigger: "action_overdue" },
      {
        actual: null,
        threshold: null,
        direction: "higher",
        actionOverdue: true,
      },
    ),
    true,
  );
  assert.equal(
    matchesRedFlagRule(
      { trigger: "decision_overdue" },
      {
        actual: null,
        threshold: null,
        direction: "higher",
        decisionOverdue: true,
      },
    ),
    true,
  );
  assert.equal(
    matchesRedFlagRule(
      { trigger: "decision_overdue" },
      {
        actual: null,
        threshold: null,
        direction: "higher",
        decisionOverdue: false,
      },
    ),
    false,
  );
});

test("multiple period degradation follows KPI direction", () => {
  assert.equal(
    matchesRedFlagRule(
      {
        trigger: "multiple_period_degradation",
        configuration: { periods: 3, minimumChangePercent: 10 },
      },
      {
        actual: 10,
        threshold: null,
        direction: "higher",
        history: [80, 90, 100],
      },
    ),
    true,
  );
  assert.equal(
    matchesRedFlagRule(
      { trigger: "multiple_period_degradation", configuration: { periods: 3 } },
      { actual: 10, threshold: null, direction: "lower", history: [10, 9, 8] },
    ),
    true,
  );
  assert.equal(
    matchesRedFlagRule(
      { trigger: "multiple_period_degradation" },
      { actual: 10, threshold: null, direction: "higher", history: [80, 90] },
    ),
    false,
  );
});
