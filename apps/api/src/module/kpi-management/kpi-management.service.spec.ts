import assert from "node:assert/strict";
import { test } from "node:test";
import { KpiManagementService } from "./kpi-management.service.js";
import { KpiManagementRepository } from "./kpi-management.repository.js";

test("higher KPIs use target and critical thresholds to classify health", () => {
  assert.equal(
    KpiManagementService.health(100, 100, "higher", 85, 70),
    "green",
  );
  assert.equal(KpiManagementService.health(69, 100, "higher", 85, 70), "red");
  assert.equal(
    KpiManagementService.health(80, 100, "higher", 85, 70),
    "yellow",
  );
});

test("lower KPIs reverse the target comparison and use the upper critical bound", () => {
  assert.equal(
    KpiManagementService.health(10, 12, "lower", 13.8, 15.6),
    "green",
  );
  assert.equal(
    KpiManagementService.health(15.7, 12, "lower", 13.8, 15.6),
    "red",
  );
  assert.equal(
    KpiManagementService.health(14, 12, "lower", 13.8, 15.6),
    "yellow",
  );
});

test("range KPIs classify values by absolute deviation around their target", () => {
  assert.equal(KpiManagementService.health(100, 100, "range", 5, 10), "green");
  assert.equal(KpiManagementService.health(106, 100, "range", 5, 10), "yellow");
  assert.equal(KpiManagementService.health(89, 100, "range", 5, 10), "red");
  assert.equal(
    KpiManagementRepository.health(106, 100, "range", 5, 10),
    "yellow",
  );
  assert.deepEqual(KpiManagementService.thresholds("range", 100), {
    warning: 5,
    critical: 10,
  });
  assert.throws(() => KpiManagementService.thresholds("range", 100, 12, 8));
});

test("missing values and fallback thresholds match Laravel calculations", () => {
  assert.equal(KpiManagementService.health(null, 100, "higher"), "unknown");
  assert.equal(
    KpiManagementService.health(Number.NaN, 100, "higher"),
    "unknown",
  );
  assert.equal(KpiManagementService.defaultWarning(100, "higher"), 85);
  assert.equal(KpiManagementService.defaultCritical(100, "lower"), 130);
});

test("zero and negative reported values remain real measurements", () => {
  assert.equal(KpiManagementService.health(0, 100, "higher", 85, 70), "red");
  assert.equal(KpiManagementService.health(-4, 100, "higher", 85, 70), "red");
  assert.equal(
    KpiManagementService.health(0, 12, "lower", 13.8, 15.6),
    "green",
  );
});

test("input modes calculate stable actual values and reject incomplete formulas", () => {
  assert.equal(KpiManagementRepository.calculateActualValue("direct", 0), 0);
  assert.equal(
    KpiManagementRepository.calculateActualValue("ratio", null, {
      numerator: 3,
      denominator: 4,
    }),
    0.75,
  );
  assert.equal(
    KpiManagementRepository.calculateActualValue("percentage", null, {
      numerator: 3,
      denominator: 4,
    }),
    75,
  );
  assert.equal(
    KpiManagementRepository.calculateActualValue("percentage", null, {
      numerator: 3,
      denominator: 0,
    }),
    null,
  );
  assert.equal(
    KpiManagementRepository.calculateActualValue("checklist", null, {
      completed: 3,
      total: 4,
    }),
    75,
  );
  assert.equal(
    KpiManagementRepository.calculateActualValue("checklist", null, {
      completed: 5,
      total: 4,
    }),
    null,
  );
  assert.equal(
    KpiManagementRepository.calculateActualValue("formula", null, {
      values: [2, 3, 5],
    }),
    10,
  );
  assert.equal(
    KpiManagementRepository.calculateActualValue("components", null, {
      values: [2, Number.NaN],
    }),
    null,
  );
});

test("KPI codes and threshold consistency follow Laravel normalization rules", () => {
  assert.equal(
    KpiManagementService.normalizeCode(" KPI ۱۲ / X! "),
    "kpi-12---x",
  );
  assert.equal(KpiManagementService.validCode("sales_kpi"), true);
  assert.equal(KpiManagementService.validCode("12-sales"), false);
  assert.deepEqual(KpiManagementService.thresholds("higher", 100), {
    warning: 85,
    critical: 70,
  });
  const lowerThresholds = KpiManagementService.thresholds("lower", 100);
  assert.ok(Math.abs(lowerThresholds.warning - 115) < 1e-9);
  assert.equal(lowerThresholds.critical, 130);
  assert.throws(() => KpiManagementService.thresholds("higher", 100, 70, 80));
  assert.throws(() => KpiManagementService.thresholds("lower", 100, 130, 120));
});
