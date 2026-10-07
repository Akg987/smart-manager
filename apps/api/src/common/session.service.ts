import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { DRIZZLE_DB, type DrizzleDatabase } from "../database/database.token.js";
import { sessions, users } from "../../../../src/db/schema.js";

export const SESSION_COOKIE = "smart_manager_session";
const sessionLifetimeSeconds = 60 * 60 * 12;
const rememberedLifetimeSeconds = 60 * 60 * 24 * 30;

@Injectable()
export class SessionService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

	async create(userId: bigint, request: Request, response: Response, remember = false) {
		const id = randomBytes(32).toString("base64url");
		const now = Math.floor(Date.now() / 1000);
		await this.db.insert(sessions).values({ id, userId, ipAddress: request.ip ?? null, userAgent: request.get("user-agent") ?? null, payload: JSON.stringify({ remember }), lastActivity: now });
		response.cookie(SESSION_COOKIE, id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", ...(remember ? { maxAge: rememberedLifetimeSeconds * 1000 } : {}) });
	}

	async createPending(userId: bigint, request: Request, response: Response, remember: boolean) {
		const id = randomBytes(32).toString("base64url");
		const now = Math.floor(Date.now() / 1000);
		await this.db.insert(sessions).values({ id, userId: null, ipAddress: request.ip ?? null, userAgent: request.get("user-agent") ?? null, payload: JSON.stringify({ purpose: "two-factor", pendingUserId: userId.toString(), remember, expiresAt: now + 10 * 60 }), lastActivity: now });
		response.cookie(SESSION_COOKIE, id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 10 * 60 * 1000 });
	}

	async pendingUser(request: Request) {
		const id = request.cookies?.[SESSION_COOKIE];
		if (typeof id !== "string") throw new UnauthorizedException("A two-factor challenge is not pending.");
		const [session] = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
		let payload: { purpose?: string; pendingUserId?: string; remember?: boolean; expiresAt?: number };
		try { payload = JSON.parse(session?.payload ?? "{}"); } catch { throw new UnauthorizedException("A two-factor challenge is not pending."); }
		if (!session || session.userId !== null || payload.purpose !== "two-factor" || !payload.pendingUserId || !payload.expiresAt || payload.expiresAt <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException("A two-factor challenge is not pending.");
		const [user] = await this.db.select().from(users).where(eq(users.id, BigInt(payload.pendingUserId))).limit(1);
		if (!user?.approvedAt) throw new UnauthorizedException("A two-factor challenge is not pending.");
		return { user, remember: payload.remember === true };
	}

	async completePending(request: Request, response: Response) {
		const id = request.cookies?.[SESSION_COOKIE];
		if (typeof id !== "string") throw new UnauthorizedException("A two-factor challenge is not pending.");
		const result = await this.db.transaction(async (tx) => {
			const [session] = await tx.select().from(sessions).where(eq(sessions.id, id)).for("update").limit(1);
			let payload: { purpose?: string; pendingUserId?: string; remember?: boolean; expiresAt?: number };
			try { payload = JSON.parse(session?.payload ?? "{}"); } catch { throw new UnauthorizedException("A two-factor challenge is not pending."); }
			if (!session || session.userId !== null || payload.purpose !== "two-factor" || !payload.pendingUserId || !payload.expiresAt || payload.expiresAt <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException("A two-factor challenge is not pending.");
			const userId = BigInt(payload.pendingUserId);
			const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
			if (!user?.approvedAt) throw new UnauthorizedException("A two-factor challenge is not pending.");
			const nextId = randomBytes(32).toString("base64url");
			const now = Math.floor(Date.now() / 1000);
			await tx.delete(sessions).where(eq(sessions.id, id));
			await tx.insert(sessions).values({ id: nextId, userId, ipAddress: request.ip ?? null, userAgent: request.get("user-agent") ?? null, payload: JSON.stringify({ remember: payload.remember === true }), lastActivity: now });
			return { id: nextId, remember: payload.remember === true };
		});
		response.cookie(SESSION_COOKIE, result.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", ...(result.remember ? { maxAge: rememberedLifetimeSeconds * 1000 } : {}) });
	}

	async user(request: Request) {
		const id = request.cookies?.[SESSION_COOKIE];
		if (typeof id !== "string" || id.length < 40) throw new UnauthorizedException("Authentication required.");	
		const [row] = await this.db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(eq(sessions.id, id)).limit(1);
		let remember = false;
		try { remember = JSON.parse(row?.session.payload ?? "{}").remember === true; } catch { /* invalid session payload expires by the short policy */ }
		const cutoff = Math.floor(Date.now() / 1000) - (remember ? rememberedLifetimeSeconds : sessionLifetimeSeconds);
		if (!row?.user.approvedAt || row.session.lastActivity <= cutoff) throw new UnauthorizedException("Authentication required.");
		await this.db.update(sessions).set({ lastActivity: Math.floor(Date.now() / 1000) }).where(eq(sessions.id, id));
		return row.user;
	}

	async destroy(request: Request, response: Response) {
		const id = request.cookies?.[SESSION_COOKIE];
		if (typeof id === "string") await this.db.delete(sessions).where(eq(sessions.id, id));
		response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
	}

	async regenerate(request: Request, response: Response, userId: bigint) {
		const previousId = request.cookies?.[SESSION_COOKIE];
		const nextId = randomBytes(32).toString("base64url");
		const now = Math.floor(Date.now() / 1000);
		const remember = await this.db.transaction(async (tx) => {
			let remember = false;
			if (typeof previousId === "string") {
				const [previous] = await tx.select().from(sessions).where(eq(sessions.id, previousId)).limit(1);
				try { remember = JSON.parse(previous?.payload ?? "{}").remember === true; } catch { /* use standard session lifetime */ }
				await tx.delete(sessions).where(eq(sessions.id, previousId));
			}
			await tx.insert(sessions).values({ id: nextId, userId, ipAddress: request.ip ?? null, userAgent: request.get("user-agent") ?? null, payload: JSON.stringify({ remember }), lastActivity: now });
			return remember;
		});
		response.cookie(SESSION_COOKIE, nextId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", ...(remember ? { maxAge: rememberedLifetimeSeconds * 1000 } : {}) });
	}
}

export interface AuthenticatedRequest extends Request { currentUser: typeof users.$inferSelect }
