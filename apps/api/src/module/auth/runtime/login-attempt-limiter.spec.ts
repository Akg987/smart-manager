import assert from "node:assert/strict";
import test from "node:test";
import { HttpException, HttpStatus } from "@nestjs/common";
import { LoginAttemptLimiter } from "./login-attempt-limiter.js";

test("login attempts are blocked at the limit and unlocked after cooldown", () => {
  const limiter = new LoginAttemptLimiter(2, 1_000, 500);
  limiter.assertAllowed("09120000000", 10_000);
  limiter.recordFailure("09120000000", 10_000);
  limiter.assertAllowed("09120000000", 10_100);
  limiter.recordFailure("09120000000", 10_100);
  assert.throws(
    () => limiter.assertAllowed("09120000000", 10_200),
    (error: unknown) =>
      error instanceof HttpException &&
      error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
  );
  assert.doesNotThrow(() => limiter.assertAllowed("09120000000", 10_600));
});

test("login attempts expire after their rolling window", () => {
  const limiter = new LoginAttemptLimiter(2, 1_000, 500);
  limiter.recordFailure("09120000000", 10_000);
  limiter.recordFailure("09120000000", 10_100);
  assert.doesNotThrow(() => limiter.assertAllowed("09120000000", 11_100));
  limiter.recordFailure("09120000000", 11_101);
  assert.doesNotThrow(() => limiter.assertAllowed("09120000000", 11_102));
});

test("a successful login clears the identifier's failures", () => {
  const limiter = new LoginAttemptLimiter(2, 1_000, 500);
  limiter.recordFailure("09120000000", 10_000);
  limiter.recordFailure("09120000000", 10_100);
  limiter.recordSuccess("09120000000");
  limiter.assertAllowed("09120000000", 10_101);
  limiter.recordFailure("09120000000", 10_102);
  assert.doesNotThrow(() => limiter.assertAllowed("09120000000", 10_103));
});

test("failure identifiers are normalized consistently", () => {
  const limiter = new LoginAttemptLimiter(1, 1_000, 500);
  limiter.recordFailure(" 09120000000 ", 10_000);
  assert.throws(
    () => limiter.assertAllowed("09120000000", 10_001),
    (error: unknown) =>
      error instanceof HttpException &&
      error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
  );
});
