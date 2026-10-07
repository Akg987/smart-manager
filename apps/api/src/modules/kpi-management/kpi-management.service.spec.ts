import assert from "node:assert/strict";
import { test } from "node:test";
import { KpiManagementService } from "./kpi-management.service.js";

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

test("missing values and fallback thresholds match Laravel calculations", () => {
  assert.equal(KpiManagementService.health(null, 100, "higher"), "unknown");
  assert.equal(
    KpiManagementService.health(Number.NaN, 100, "higher"),
    "unknown",
  );
  assert.equal(KpiManagementService.defaultWarning(100, "higher"), 85);
  assert.equal(KpiManagementService.defaultCritical(100, "lower"), 130);
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
