import type { FastifyReply, FastifyRequest } from "fastify";
import type { users } from "../../../../src/db/schema.js";
import type { SmartManagerAuthContext } from "../module/permissions/smart-manager-authorization.js";

export type AppRequest = FastifyRequest & {
  cookies: Record<string, string | undefined>;
  currentUser?: typeof users.$inferSelect;
  authContext?: SmartManagerAuthContext;
  uploadedFile?: {
    buffer: Buffer;
    filename: string;
    mimetype: string;
    fields?: Record<string, string>;
  };
};

export type AppReply = FastifyReply;

export type CookieWriter = {
  setCookie?: (
    name: string,
    value: string,
    options?: Record<string, unknown>,
  ) => unknown;
  cookie?: (
    name: string,
    value: string,
    options?: Record<string, unknown>,
  ) => unknown;
  clearCookie?: (name: string, options?: Record<string, unknown>) => unknown;
};

export function requestIp(request: FastifyRequest) {
  return request.ip ?? null;
}

export function requestUserAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export function writeCookie(
  reply: CookieWriter,
  name: string,
  value: string,
  options: Record<string, unknown> = {},
) {
  if (typeof reply.setCookie === "function")
    return reply.setCookie(name, value, options);
  if (typeof reply.cookie === "function")
    return reply.cookie(name, value, options);
  throw new Error("Response adapter cannot write cookies.");
}

export function removeCookie(
  reply: CookieWriter,
  name: string,
  options: Record<string, unknown> = {},
) {
  if (typeof reply.clearCookie === "function")
    return reply.clearCookie(name, options);
  if (typeof reply.setCookie === "function")
    return reply.setCookie(name, "", { ...options, maxAge: 0 });
  throw new Error("Response adapter cannot clear cookies.");
}
