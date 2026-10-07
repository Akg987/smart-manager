import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { Test } from "@nestjs/testing";
import { test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { AuthController } from "./auth.controller.js";
import { DashboardController } from "../dashboard/dashboard.controller.js";
import { AuthService } from "./auth.service.js";
import { DashboardService } from "../dashboard/dashboard.service.js";
import { KpiManagementService } from "../kpi-management/kpi-management.service.js";
import { CorrectiveActionsService } from "../corrective-actions/corrective-actions.service.js";
import { SessionService, SESSION_COOKIE } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { ValidationExceptionFilter } from "../../common/validation-exception.filter.js";
import { SmsIppanelHubService } from "../sms-ippanel-hub/sms-ippanel-hub.service.js";

test("login cookie authorizes a real dashboard API operation", { timeout: 15_000 }, async () => {
	const digits = randomBytes(5).toString("hex").replace(/[a-f]/g, "1").slice(0, 10);
	const mobile = `09${digits}`.slice(0, 11);
	const password = randomBytes(18).toString("base64url");
	const user = { id: BigInt(`1${Date.now()}`), mobile, firstName: null, lastName: null, role: "user", departmentId: null, approvedAt: new Date(), password: "", rememberToken: null };
	let sessionId = "";
	const auth = { authenticate: async (candidate: string, secret: string) => candidate === mobile && secret === password ? user : Promise.reject(new Error("Invalid credentials.")) };
	const sessions = {
		create: async (_userId: bigint, _request: Request, response: Response) => { sessionId = randomBytes(32).toString("base64url"); response.cookie(SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", path: "/" }); },
		user: async (request: Request) => request.cookies?.[SESSION_COOKIE] === sessionId ? user : Promise.reject(new Error("Authentication required.")),
		destroy: async () => undefined,
	};
	const dashboard = { snapshot: async (userId: bigint) => ({ authenticatedUser: userId.toString(), ownedActions: 0, activeKpis: 0 }) };
	const moduleRef = await Test.createTestingModule({
		controllers: [AuthController, DashboardController],
		providers: [SessionGuard, { provide: AuthService, useValue: auth }, { provide: SessionService, useValue: sessions }, { provide: SmsIppanelHubService, useValue: { configured: async () => false } }, { provide: DashboardService, useValue: dashboard }, { provide: KpiManagementService, useValue: {} }, { provide: CorrectiveActionsService, useValue: {} }],
	}).compile();
	const app = moduleRef.createNestApplication();
	app.setGlobalPrefix("api");
	app.use((request: Request, _response: Response, next: NextFunction) => { request.cookies = Object.fromEntries((request.headers.cookie ?? "").split(";").filter(Boolean).map((item) => item.trim().split(/=(.*)/s).slice(0, 2) as [string, string])); next(); });
	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
	app.useGlobalFilters(new ValidationExceptionFilter());
	await app.listen(0, "127.0.0.1");
	try {
		const address = app.getHttpServer().address();
		if (!address || typeof address === "string") throw new Error("Test server did not open a TCP port.");
		const base = `http://127.0.0.1:${address.port}/api`;
		const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mobile, password }), signal: AbortSignal.timeout(5_000) });
		assert.equal(login.status, 200, await login.clone().text());
		const cookie = login.headers.get("set-cookie");
		assert.ok(cookie?.includes(`${SESSION_COOKIE}=`));
		const dashboardResponse = await fetch(`${base}/dashboard`, { headers: { cookie: cookie!.split(";")[0] }, signal: AbortSignal.timeout(5_000) });
		assert.equal(dashboardResponse.status, 200);
		assert.equal((await dashboardResponse.json()).dashboard.authenticatedUser, user.id.toString());
	} finally { await app.close(); await moduleRef.close(); }
});

import assert from "node:assert/strict";
