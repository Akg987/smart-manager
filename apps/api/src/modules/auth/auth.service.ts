import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { jalaliDateToGregorian } from "../../shared/jalali.js";
import { otpChallenges, passwordResetTokens, users, type OtpPurpose } from "../../../../../src/db/schema.js";
import { SmsIppanelHubService } from "../sms-ippanel-hub/sms-ippanel-hub.service.js";

@Injectable()
export class AuthService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase, private readonly sms: SmsIppanelHubService) {}

	static requiresTwoFactor(enabled: boolean, roles: readonly string[], userRole: string, transportAvailable: boolean, failOpen: boolean): boolean {
		return enabled && roles.includes(userRole) && (transportAvailable || !failOpen);
	}

	/** Laravel Hash::check uses bcrypt; bcryptjs understands Laravel's $2y$ prefix. */
	async validatePassword(plainText: string, storedHash: string): Promise<boolean> {
		if (!/^\$2[aby]\$\d\d\$/.test(storedHash)) return false;
		return compare(plainText, storedHash.replace(/^\$2y\$/, "$2b$"));
	}

	async register(input: { mobile: string; password: string; firstName: string; lastName: string; nationalCode: string; birthDate: string; address: string }, requiresApproval: boolean) {
		const birthDate = jalaliDateToGregorian(input.birthDate);
		if (!birthDate) throw new BadRequestException("Invalid Jalali birth date.");
		const [user] = await this.db.insert(users).values({ ...input, birthDate, password: await hash(input.password, 10), role: "user", approvedAt: requiresApproval ? null : new Date() }).returning();
		return user;
	}

	async authenticate(mobile: string, password: string) {
		const [user] = await this.db.select().from(users).where(eq(users.mobile, mobile)).limit(1);
		if (!user || !(await this.validatePassword(password, user.password))) throw new UnauthorizedException("Invalid credentials.");
		if (!user.approvedAt) throw new UnauthorizedException("Account approval is pending.");
		return user;
	}

	async provisionFirstAdmin(mobile: string, password: string) {
		return this.db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(738201)`);
			const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
			if (existing) throw new BadRequestException("Initial setup has already been completed.");
			const [admin] = await tx.insert(users).values({ mobile, password: await hash(password, 10), role: "admin", approvedAt: new Date() }).returning();
			return admin;
		});
	}

	async createOtp(input: { purpose: OtpPurpose; identifier: string; code: string; now?: Date }) {
		const now = input.now ?? new Date();
		const codeHash = await hash(input.code, 10);
		return this.db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.purpose}:${input.identifier}`}))`);
			const existing = (await tx.select().from(otpChallenges).where(and(eq(otpChallenges.purpose, input.purpose), eq(otpChallenges.identifier, input.identifier))).limit(1))[0];
			if (existing && now.getTime() - existing.sentAt.getTime() < 60_000) throw new HttpException("Wait before requesting another code.", HttpStatus.TOO_MANY_REQUESTS);
			const [row] = await tx.insert(otpChallenges).values({
				purpose: input.purpose, identifier: input.identifier, codeHash, attempts: 0,
				sentAt: now, expiresAt: new Date(now.getTime() + 5 * 60_000),
			}).onConflictDoUpdate({
				target: [otpChallenges.purpose, otpChallenges.identifier],
				set: { codeHash, attempts: 0, sentAt: now, expiresAt: new Date(now.getTime() + 5 * 60_000) },
			}).returning();
			return row;
		});
	}

	/** Persist a hashed challenge, then deliver its plaintext code through the configured IPPanel pattern. */
	async issueOtp(input: { purpose: OtpPurpose; identifier: string; now?: Date }) {
		const patternCode = process.env.IPPANEL_OTP_PATTERN_CODE?.trim();
		if (!patternCode) throw new ServiceUnavailableException("IPPANEL_OTP_PATTERN_CODE is required to deliver OTP messages.");
		const code = String(randomInt(100_000, 1_000_000));
		const challenge = await this.createOtp({ ...input, code });
		await this.sms.sendOtp(patternCode, input.identifier, code);
		return { sent: true, expiresAt: challenge.expiresAt };
	}

	async consumeOtp(purpose: OtpPurpose, identifier: string, code: string, now = new Date()): Promise<boolean> {
		return this.db.transaction(async (tx) => {
			const [challenge] = await tx.select().from(otpChallenges).where(and(eq(otpChallenges.purpose, purpose), eq(otpChallenges.identifier, identifier))).for("update").limit(1);
			if (!challenge) return false;
			if (challenge.expiresAt <= now || challenge.attempts >= 5) {
				await tx.delete(otpChallenges).where(eq(otpChallenges.id, challenge.id));
				return false;
			}
			if (!(await compare(code, challenge.codeHash))) {
				await tx.update(otpChallenges).set({ attempts: sql`${otpChallenges.attempts} + 1` }).where(eq(otpChallenges.id, challenge.id));
				return false;
			}
			await tx.delete(otpChallenges).where(eq(otpChallenges.id, challenge.id));
			return true;
		});
	}

	async resetPassword(mobile: string, token: string, newPassword: string) {
		return this.db.transaction(async (tx) => {
			const [reset] = await tx.select().from(passwordResetTokens).where(eq(passwordResetTokens.mobile, mobile)).limit(1);
			if (!reset || !(await compare(token, reset.token))) throw new UnauthorizedException("Invalid or expired reset token.");
			const [user] = await tx.update(users).set({ password: await hash(newPassword, 10), updatedAt: new Date() }).where(eq(users.mobile, mobile)).returning();
			if (!user) throw new BadRequestException("Account not found.");
			await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.mobile, mobile));
			return user;
		});
	}

	async resetPasswordWithOtp(mobile: string, code: string, newPassword: string) {
		const result = await this.db.transaction(async (tx) => {
			const [challenge] = await tx.select().from(otpChallenges).where(and(eq(otpChallenges.purpose, "password-reset"), eq(otpChallenges.identifier, mobile))).for("update").limit(1);
			if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return { invalid: true as const };
			if (!(await compare(code, challenge.codeHash))) {
				await tx.update(otpChallenges).set({ attempts: sql`${otpChallenges.attempts} + 1` }).where(eq(otpChallenges.id, challenge.id));
				return { invalid: true as const };
			}
			const [user] = await tx.update(users).set({ password: await hash(newPassword, 10), updatedAt: new Date() }).where(eq(users.mobile, mobile)).returning();
			if (!user) return { missing: true as const };
			await tx.delete(otpChallenges).where(eq(otpChallenges.id, challenge.id));
			await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.mobile, mobile));
			return { user };
		});
		if ("invalid" in result) throw new UnauthorizedException("Invalid or expired verification code.");
		if ("missing" in result) throw new BadRequestException("Account not found.");
		return result.user;
	}
}
