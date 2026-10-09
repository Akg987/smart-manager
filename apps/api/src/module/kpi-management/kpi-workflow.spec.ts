import assert from "node:assert/strict";
import { test } from "node:test";
import { canCloseRedFlag, canReviewCheckin } from "./kpi-workflow.js";

test("KPI check-in review requires a pending submission and a different reviewer", () => {
  assert.equal(
    canReviewCheckin({ status: "submitted", userId: 10n }, 20n),
    true,
  );
  assert.equal(canReviewCheckin({ status: "revised", userId: 10n }, 20n), true);
  assert.equal(
    canReviewCheckin({ status: "data_submitted", userId: 10n }, 20n),
    true,
  );
  assert.equal(
    canReviewCheckin({ status: "data_submitted", userId: 20n }, 20n),
    false,
  );
  assert.equal(
    canReviewCheckin({ status: "submitted", userId: 20n }, 20n),
    false,
  );
  assert.equal(canReviewCheckin({ status: "draft", userId: 10n }, 20n), false);
});

test("Red Flags close only after resolution and evidence or an approved exception", () => {
  assert.equal(
    canCloseRedFlag({
      status: "new",
      closureEvidence: "proof",
      exceptionApproved: false,
    }),
    false,
  );
  assert.equal(
    canCloseRedFlag({
      status: "resolved",
      closureEvidence: "proof",
      exceptionApproved: false,
    }),
    true,
  );
  assert.equal(
    canCloseRedFlag({
      status: "resolved",
      exceptionReason: "exception",
      exceptionApproved: false,
    }),
    false,
  );
  assert.equal(
    canCloseRedFlag({
      status: "resolved",
      exceptionReason: "exception",
      exceptionApproved: true,
    }),
    true,
  );
});
