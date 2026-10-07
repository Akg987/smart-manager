import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { SessionGuard } from "../../common/session.guard.js";
import { SessionService, type AuthenticatedRequest } from "../../common/session.service.js";
import { AuthService } from "./auth.service.js";
import { LoginDto, OtpRequestDto, RegisterDto, ResetPasswordDto, SetupDto, TwoFactorCodeDto } from "./auth.dto.js";
import { SmsIppanelHubService } from "../sms-ippanel-hub/sms-ippanel-hub.service.js";

const publicUser = (user: { id: bigint; mobile: string; firstName: string | null; lastName: string | null; role: string; departmentId: bigint | null }) => ({ ...user, id: user.id.toString(), departmentId: user.departmentId?.toString() ?? null });

@Controller("auth")
export class AuthController {
	constructor(private readonly auth: AuthService, private readonly sessions: SessionService, private readonly sms: SmsIppanelHubService) {}
	@Post("login") @HttpCode(HttpStatus.OK) async login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const user = await this.auth.authenticate(body.mobile, body.password);
		const roles = (process.env.TWO_FACTOR_ROLES ?? "admin").split(",").map((role) => role.trim()).filter(Boolean);
		const failOpen = process.env.TWO_FACTOR_FAIL_OPEN?.toLowerCase() !== "false";
		const required = AuthService.requiresTwoFactor(process.env.TWO_FACTOR_ENABLED?.toLowerCase() !== "false", roles, user.role, await this.sms.configured(), failOpen);
		if (required) {
			await this.auth.issueOtp({ purpose: "two-factor", identifier: user.mobile });
			await this.sessions.createPending(user.id, req, res, body.remember ?? false);
			return { twoFactorRequired: true, mobile: `${user.mobile.slice(0, 4)}*****${user.mobile.slice(-2)}` };
		}
		await this.sessions.create(user.id, req, res, body.remember ?? false);
		return { twoFactorRequired: false, user: publicUser(user) };
	}
	@Post("two-factor/verify") @HttpCode(HttpStatus.OK) async verifyTwoFactor(@Body() body: TwoFactorCodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const pending = await this.sessions.pendingUser(req);
		if (!(await this.auth.consumeOtp("two-factor", pending.user.mobile, body.code))) throw new BadRequestException({ message: "Validation failed.", errors: { code: ["Invalid or expired verification code."] } });
		await this.sessions.completePending(req, res);
		return { user: publicUser(pending.user) };
	}
	@Post("two-factor/resend") @HttpCode(HttpStatus.OK) async resendTwoFactor(@Req() req: Request) {
		const pending = await this.sessions.pendingUser(req);
		return this.auth.issueOtp({ purpose: "two-factor", identifier: pending.user.mobile });
	}
	@Post("two-factor/cancel") @HttpCode(HttpStatus.OK) async cancelTwoFactor(@Req() req: Request, @Res({ passthrough: true }) res: Response) { await this.sessions.destroy(req, res); return { ok: true }; }
	@Post("register") async register(@Body() body: RegisterDto) {
		if (body.password !== body.password_confirmation) throw new BadRequestException({ message: "Validation failed.", errors: { password_confirmation: ["Passwords do not match."] } });
		const user = await this.auth.register({ mobile: body.mobile, password: body.password, firstName: body.first_name, lastName: body.last_name, nationalCode: body.national_code, birthDate: body.birth_date, address: body.address }, true);
		return { user: { id: user.id.toString(), mobile: user.mobile, firstName: user.firstName, lastName: user.lastName, role: user.role, approvedAt: user.approvedAt } };
	}
	@Post("setup") async setup(@Body() body: SetupDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
		if (body.password !== body.password_confirmation) throw new BadRequestException({ message: "Validation failed.", errors: { password_confirmation: ["Passwords do not match."] } });
		const admin = await this.auth.provisionFirstAdmin(body.mobile, body.password);
		await this.sessions.create(admin.id, req, res);
		return { user: publicUser(admin) };
	}
	@Post("password-reset/request") requestPasswordReset(@Body() body: OtpRequestDto) { return this.auth.issueOtp({ purpose: "password-reset", identifier: body.mobile }); }
	@Post("password-reset/confirm") async confirmPasswordReset(@Body() body: ResetPasswordDto) {
		if (body.password !== body.password_confirmation) throw new BadRequestException({ message: "Validation failed.", errors: { password_confirmation: ["Passwords do not match."] } });
		const user = await this.auth.resetPasswordWithOtp(body.mobile, body.code, body.password);
		return { user: { id: user.id.toString(), mobile: user.mobile } };
	}
	@Post("logout") @HttpCode(HttpStatus.OK) async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { await this.sessions.destroy(req, res); return { ok: true }; }
	@Get("me") @UseGuards(SessionGuard) me(@Req() req: AuthenticatedRequest) { return { user: publicUser(req.currentUser) }; }
}
