import { createHash } from "node:crypto";
import { HttpException, HttpStatus } from "@nestjs/common";

type AttemptState = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number | null;
};

export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, AttemptState>();

  constructor(
    private readonly maxAttempts = 8,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly blockMs = 15 * 60 * 1000,
    private readonly maxEntries = 10_000,
  ) {}

  assertAllowed(identifier: string, now = Date.now()) {
    const key = this.key(identifier);
    const current = this.attempts.get(key);
    if (!current) return;
    if (current.blockedUntil !== null && current.blockedUntil > now)
      throw new HttpException(
        "Too many login attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if (
      current.blockedUntil !== null ||
      now - current.windowStartedAt >= this.windowMs
    )
      this.attempts.delete(key);
  }

  recordFailure(identifier: string, now = Date.now()) {
    const key = this.key(identifier);
    const current = this.attempts.get(key);
    const state =
      !current || now - current.windowStartedAt >= this.windowMs
        ? { count: 0, windowStartedAt: now, blockedUntil: null }
        : current;
    state.count += 1;
    if (state.count >= this.maxAttempts)
      state.blockedUntil = now + this.blockMs;
    this.attempts.set(key, state);
    if (this.attempts.size > this.maxEntries) this.prune(now);
  }

  recordSuccess(identifier: string) {
    this.attempts.delete(this.key(identifier));
  }

  private key(identifier: string) {
    return createHash("sha256")
      .update(identifier.trim().replace(/\s/g, ""))
      .digest("hex");
  }

  private prune(now: number) {
    for (const [key, state] of this.attempts) {
      if (
        (state.blockedUntil !== null && state.blockedUntil <= now) ||
        (state.blockedUntil === null &&
          now - state.windowStartedAt >= this.windowMs)
      )
        this.attempts.delete(key);
    }
  }
}
