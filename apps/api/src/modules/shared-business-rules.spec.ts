import assert from "node:assert/strict";
import { test } from "node:test";
import { CorrectiveActionsService } from "./corrective-actions/corrective-actions.service.js";
import { InboxAuditService } from "./inbox-audit/inbox-audit.service.js";
import { OrganizationsService } from "./organizations/organizations.service.js";
import { SmsIppanelHubService } from "./sms-ippanel-hub/sms-ippanel-hub.service.js";
import {
  jalaliDateToGregorian,
  normalizeJalaliPeriod,
} from "../shared/jalali.js";
import { AuthService } from "./auth/auth.service.js";
import { hash } from "bcryptjs";
import {
  decryptLaravelValue,
  encryptLaravelValue,
} from "../shared/laravel-crypto.js";
import { PgDialect } from "drizzle-orm/pg-core";
import { inboxNotifications } from "../../../../src/db/schema.js";

test("alert bands follow the deterministic severity rules", () => {
  assert.equal(CorrectiveActionsService.band("urgent"), "critical");
  assert.equal(CorrectiveActionsService.band("high"), "red");
  assert.equal(CorrectiveActionsService.band("medium"), "yellow");
  assert.equal(CorrectiveActionsService.band("low"), "other");
});

test("department codes transliterate Persian digits, fold case and enforce the source shape", () => {
  const code = OrganizationsService.normalizeCode("  A ۱۲ / B! ");
  assert.equal(code, "a-12---b");
  assert.equal(OrganizationsService.isValidCode("unit_2"), true);
  assert.equal(OrganizationsService.isValidCode("2unit"), false);
});

test("phone normalization returns the IPPanel E.164 representation", () => {
  assert.equal(
    SmsIppanelHubService.normalizePhone("0912 345 6789"),
    "+989123456789",
  );
  assert.equal(
    SmsIppanelHubService.normalizePhone("۹۱۲۳۴۵۶۷۸۹"),
    "+989123456789",
  );
  assert.equal(SmsIppanelHubService.normalizePhone("123"), "");
});

test("IPPanel sender, pattern, and API key display are normalized without exposing credentials", () => {
  assert.equal(SmsIppanelHubService.normalizeSender("۳۰۰۰۵۰۵"), "+983000505");
  assert.equal(SmsIppanelHubService.normalizeSender("09123456789"), "");
  assert.equal(
    SmsIppanelHubService.normalizePatternCode(" pattern: ۱۲۳ABC "),
    "123ABC",
  );
  assert.equal(SmsIppanelHubService.maskApiKey("1234567890"), "1234••••7890");
});

test("inbox URLs remain same-origin and reject control or script schemes", () => {
  assert.equal(
    InboxAuditService.safeInternalHref("/kpis?period=1405-01"),
    "/kpis?period=1405-01",
  );
  assert.equal(InboxAuditService.safeInternalHref("//evil.example"), "");
  assert.equal(InboxAuditService.safeInternalHref("/javascript:alert(1)"), "");
  assert.equal(InboxAuditService.safeInternalHref("/a\\b"), "");
});

test("inbox retention query targets only read messages older than the cutoff", () => {
  const cutoff = new Date("2026-01-01T00:00:00.000Z");
  const query = new PgDialect().sqlToQuery(
    InboxAuditService.readRetentionPredicate(cutoff),
  );
  assert.match(query.sql, /"read_at" is not null/i);
  assert.match(query.sql, /"read_at" < \$1/i);
  assert.deepEqual(query.params, [cutoff.toISOString()]);
  assert.equal(inboxNotifications.readAt.name, "read_at");
});

test("Jalali dates and reporting periods normalize to Gregorian and canonical forms", () => {
  assert.equal(jalaliDateToGregorian("1403/01/01"), "2024-03-20");
  assert.equal(jalaliDateToGregorian("۱۴۰۳-۱۲-۳۰"), "2025-03-20");
  assert.equal(jalaliDateToGregorian("1403/12/31"), null);
  assert.equal(normalizeJalaliPeriod("۱۴۰۵-W7"), "1405-W07");
  assert.equal(normalizeJalaliPeriod("1299-W01"), null);
});

test("two-factor policy honors roles, transport availability, and fail-open", () => {
  assert.equal(
    AuthService.requiresTwoFactor(true, ["admin"], "admin", true, true),
    true,
  );
  assert.equal(
    AuthService.requiresTwoFactor(true, ["admin"], "admin", false, true),
    false,
  );
  assert.equal(
    AuthService.requiresTwoFactor(true, ["admin"], "admin", false, false),
    true,
  );
  assert.equal(
    AuthService.requiresTwoFactor(true, ["admin"], "user", true, false),
    false,
  );
});

test("OTP delivery uses IPPanel pattern params and rejects malformed codes", async () => {
  const service = Object.create(
    SmsIppanelHubService.prototype,
  ) as SmsIppanelHubService;
  let call:
    | {
        pattern: string;
        mobile: string;
        params: Record<string, string | number | boolean | null>;
      }
    | undefined;
  service.sendPattern = async (pattern, mobile, params = {}) => {
    call = { pattern, mobile, params };
  };
  await service.sendOtp("login-code", "09123456789", "123456");
  assert.deepEqual(call, {
    pattern: "login-code",
    mobile: "09123456789",
    params: { code: "123456" },
  });
  await assert.rejects(() =>
    service.sendOtp("login-code", "09123456789", "12x"),
  );
});

test("Laravel bcrypt hashes with the $2y$ prefix validate correctly", async () => {
  const service = new AuthService(undefined as never, undefined as never);
  const hashB = await hash("passphrase123", 10);
  const hashY = hashB.replace(/^\$2b\$/, "$2y$");
  assert.equal(await service.validatePassword("passphrase123", hashY), true);
  assert.equal(await service.validatePassword("wrong", hashY), false);
  assert.equal(
    await service.validatePassword("passphrase123", "plaintext"),
    false,
  );
});

test("credit thresholds match IPPanel low-balance steps and critical floor", () => {
  assert.equal(SmsIppanelHubService.resolveCreditThreshold(500_001), null);
  assert.equal(SmsIppanelHubService.resolveCreditThreshold(425_000), 450_000);
  assert.equal(SmsIppanelHubService.resolveCreditThreshold(99_999), "critical");
});

test("Laravel encrypted values round-trip and reject a tampered MAC", () => {
  const key = `base64:${Buffer.alloc(32, 7).toString("base64")}`;
  const encrypted = encryptLaravelValue("provider-secret", key);
  assert.equal(decryptLaravelValue(encrypted, key), "provider-secret");
  const payload = JSON.parse(
    Buffer.from(encrypted, "base64").toString("utf8"),
  ) as { value: string };
  payload.value = Buffer.from("tampered").toString("base64");
  assert.throws(
    () =>
      decryptLaravelValue(
        Buffer.from(JSON.stringify(payload)).toString("base64"),
        key,
      ),
    /authentication failed/,
  );
});
