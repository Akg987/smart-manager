import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export type SmartManagerJwtClaims = {
  sub: string;
  sessionId: string;
  holdingId: string;
  membershipId: string;
  activeCompanyId: string | null;
  roleIds: string[];
  scopeType: string;
  tokenVersion: number;
  iss: "smart-manager-api";
  aud: "smart-manager-web";
  iat: number;
  exp: number;
};

type RefreshClaims = {
  sub: string;
  sessionId: string;
  membershipId: string;
  tokenVersion: number;
  jti: string;
  use: "refresh";
  iss: "smart-manager-api";
  aud: "smart-manager-web";
  iat: number;
  exp: number;
};

const developmentSecrets = {
  access: randomBytes(32),
  refresh: randomBytes(32),
};
const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

function secret(kind: "access" | "refresh"): Buffer {
  const configured =
    process.env[kind === "access" ? "JWT_ACCESS_SECRET" : "JWT_REFRESH_SECRET"];
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error(
      `JWT_${kind.toUpperCase()}_SECRET must be configured in production.`,
    );
  }
  if (configured && Buffer.byteLength(configured) >= 32)
    return Buffer.from(configured);
  if (configured && process.env.NODE_ENV === "production") {
    throw new Error(
      `JWT_${kind.toUpperCase()}_SECRET must contain at least 32 bytes.`,
    );
  }
  return developmentSecrets[kind];
}

function sign<T extends object>(payload: T, key: Buffer): string {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const content = `${header}.${body}`;
  const signature = createHmac("sha256", key)
    .update(content)
    .digest("base64url");
  return `${content}.${signature}`;
}

function verify<T extends { exp: number }>(
  token: string,
  key: Buffer,
): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = createHmac("sha256", key)
    .update(`${header}.${body}`)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
    const parsedHeader = JSON.parse(
      Buffer.from(header, "base64url").toString("utf8"),
    ) as { alg?: string; typ?: string };
    if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") return null;
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as T;
    if (
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueSmartManagerAccessToken(
  claims: Omit<SmartManagerJwtClaims, "iat" | "exp" | "iss" | "aud">,
  ttlSeconds = 15 * 60,
): string {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      ...claims,
      iss: "smart-manager-api",
      aud: "smart-manager-web",
      iat: now,
      exp: now + ttlSeconds,
    } satisfies SmartManagerJwtClaims,
    secret("access"),
  );
}

export function verifySmartManagerAccessToken(
  token: string,
): SmartManagerJwtClaims | null {
  const claims = verify<SmartManagerJwtClaims>(token, secret("access"));
  return claims?.iss === "smart-manager-api" &&
    claims.aud === "smart-manager-web"
    ? claims
    : null;
}

export function issueSmartManagerRefreshToken(
  claims: Omit<RefreshClaims, "iat" | "exp" | "jti" | "use" | "iss" | "aud">,
  ttlSeconds = 30 * 24 * 60 * 60,
): { token: string; id: string; tokenHash: string } {
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  const token = sign(
    {
      ...claims,
      jti: id,
      use: "refresh",
      iss: "smart-manager-api",
      aud: "smart-manager-web",
      iat: now,
      exp: now + ttlSeconds,
    } satisfies RefreshClaims,
    secret("refresh"),
  );
  const tokenHash = createHmac("sha256", secret("refresh"))
    .update(token)
    .digest("hex");
  return { token, id, tokenHash };
}

export function verifySmartManagerRefreshToken(
  token: string,
): RefreshClaims | null {
  const claims = verify<RefreshClaims>(token, secret("refresh"));
  return claims?.use === "refresh" &&
    claims.iss === "smart-manager-api" &&
    claims.aud === "smart-manager-web"
    ? claims
    : null;
}

export function hashSmartManagerRefreshToken(token: string): string {
  return createHmac("sha256", secret("refresh")).update(token).digest("hex");
}
