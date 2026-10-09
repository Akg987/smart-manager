import assert from "node:assert/strict";
import { test } from "node:test";
import {
  issueSmartManagerAccessToken,
  issueSmartManagerRefreshToken,
  verifySmartManagerAccessToken,
  verifySmartManagerRefreshToken,
} from "../smart-manager-jwt.js";

const claims = {
  sub: "15",
  sessionId: "session-1",
  holdingId: "3",
  membershipId: "8",
  activeCompanyId: "6",
  roleIds: ["11", "12"],
  scopeType: "company",
  tokenVersion: 1,
};

test("access JWT carries the small tenant context and rejects tampering", () => {
  const token = issueSmartManagerAccessToken(claims, 60);
  const parsed = verifySmartManagerAccessToken(token);
  assert.equal(parsed?.sub, "15");
  assert.equal(parsed?.activeCompanyId, "6");
  assert.deepEqual(parsed?.roleIds, ["11", "12"]);
  assert.equal(verifySmartManagerAccessToken(`${token.slice(0, -2)}xx`), null);
});

test("expired access JWT is rejected", () => {
  const token = issueSmartManagerAccessToken(claims, -1);
  assert.equal(verifySmartManagerAccessToken(token), null);
});

test("refresh JWT is separately signed and identifies one rotation id", () => {
  const refresh = issueSmartManagerRefreshToken(
    {
      sub: claims.sub,
      sessionId: claims.sessionId,
      membershipId: claims.membershipId,
      tokenVersion: claims.tokenVersion,
    },
    60,
  );
  const parsed = verifySmartManagerRefreshToken(refresh.token);
  assert.equal(parsed?.jti, refresh.id);
  assert.equal(parsed?.use, "refresh");
  assert.equal(verifySmartManagerRefreshToken(refresh.token + "x"), null);
});
