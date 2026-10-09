import assert from "node:assert/strict";
import test from "node:test";
import { matchesEscalation, reminderSchedule } from "./escalation-engine.js";

const now = new Date("2026-10-09T12:00:00.000Z");

test("escalation rules match severity, amount, duration, delay, missing data, and no response", () => {
  assert.equal(
    matchesEscalation({
      trigger: "severity",
      configuration: { minimumSeverity: "critical" },
      target: { type: "red_flag", status: "new", severity: "critical" },
      now,
    }),
    true,
  );
  assert.equal(
    matchesEscalation({
      trigger: "amount",
      configuration: { minimumAmount: 100 },
      target: { type: "red_flag", status: "new", amount: 120 },
      now,
    }),
    true,
  );
  assert.equal(
    matchesEscalation({
      trigger: "duration",
      configuration: { minutes: 30 },
      target: {
        type: "action",
        status: "blocked",
        createdAt: new Date(now.getTime() - 31 * 60_000),
      },
      now,
    }),
    true,
  );
  assert.equal(
    matchesEscalation({
      trigger: "delay",
      configuration: {},
      target: {
        type: "decision",
        status: "approved",
        deadline: new Date(now.getTime() - 1),
      },
      now,
    }),
    true,
  );
  assert.equal(
    matchesEscalation({
      trigger: "missing_data",
      configuration: {},
      target: { type: "kpi", status: "missing", missing: true },
      now,
    }),
    true,
  );
  assert.equal(
    matchesEscalation({
      trigger: "no_response",
      configuration: { minutes: 60 },
      target: {
        type: "decision",
        status: "in_progress",
        lastRespondedAt: new Date(now.getTime() - 61 * 60_000),
      },
      now,
    }),
    true,
  );
  assert.equal(
    matchesEscalation({
      trigger: "delay",
      configuration: {},
      target: {
        type: "action",
        status: "closed",
        deadline: new Date(now.getTime() - 1),
      },
      now,
    }),
    false,
  );
});

test("reminder offsets map to before, on, and after deadline", () => {
  const dueAt = new Date("2026-10-10T12:00:00.000Z");
  assert.deepEqual(
    reminderSchedule(dueAt, [-60, 0, 60]).map((row) => [
      row.phase,
      row.scheduledFor.toISOString(),
    ]),
    [
      ["before", "2026-10-10T11:00:00.000Z"],
      ["on", "2026-10-10T12:00:00.000Z"],
      ["after", "2026-10-10T13:00:00.000Z"],
    ],
  );
});
