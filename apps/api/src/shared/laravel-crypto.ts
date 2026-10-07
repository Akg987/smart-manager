import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function encryptionKey(appKey: string): Buffer {
  const raw = appKey.startsWith("base64:")
    ? Buffer.from(appKey.slice(7), "base64")
    : Buffer.from(appKey, "utf8");
  if (raw.length !== 16 && raw.length !== 32)
    throw new Error("Laravel APP_KEY must decode to 16 or 32 bytes.");
  return raw;
}

export function encryptLaravelValue(plainText: string, appKey: string): string {
  const key = encryptionKey(appKey);
  const iv = randomBytes(16);
  const cipher = createCipheriv(
    key.length === 32 ? "aes-256-cbc" : "aes-128-cbc",
    key,
    iv,
  );
  const value = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]).toString("base64");
  const encodedIv = iv.toString("base64");
  const mac = createHmac("sha256", key)
    .update(encodedIv + value)
    .digest("hex");
  return Buffer.from(
    JSON.stringify({ iv: encodedIv, value, mac, tag: "" }),
  ).toString("base64");
}

export function decryptLaravelValue(encrypted: string, appKey: string): string {
  const key = encryptionKey(appKey);
  const payload = JSON.parse(
    Buffer.from(encrypted, "base64").toString("utf8"),
  ) as { iv?: string; value?: string; mac?: string; tag?: string };
  if (!payload.iv || !payload.value || !payload.mac || payload.tag)
    throw new Error("Invalid Laravel encrypted payload.");
  const expected = createHmac("sha256", key)
    .update(payload.iv + payload.value)
    .digest();
  const actual = Buffer.from(payload.mac, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Laravel encrypted payload authentication failed.");
  const iv = Buffer.from(payload.iv, "base64");
  if (iv.length !== 16) throw new Error("Invalid Laravel encryption IV.");
  const decipher = createDecipheriv(
    key.length === 32 ? "aes-256-cbc" : "aes-128-cbc",
    key,
    iv,
  );
  return Buffer.concat([
    decipher.update(Buffer.from(payload.value, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
