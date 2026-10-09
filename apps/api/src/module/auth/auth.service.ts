import { randomBytes } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../../../../common/http/app.exception";
import { sha256EqualsHex, sha256Hex } from "../../../../../common/utils/crypto";
import { hashPassword, verifyPassword } from "../../../../../common/utils/hash";
import { generateNumericOtp } from "../../../../../common/utils/otp";
import {
  emptyToNull,
  isUniqueViolation,
} from "../../../../../common/utils/postgres";
import { catchPostgres } from "../../../../../common/utils/postgres-error";
import type { EnvironmentVariables } from "../../../../../core/config/env.validation";
import { OtpStore } from "../../../../../core/redis/otp.store";
import { RoleRepository } from "../roles/infrastructure/persistence/role.repository";
import { SessionService } from "../session/session.service";
import { OTP_SENDER, type OtpSender } from "../sms/otp-sender";
import { UserRepository } from "../users/infrastructure/persistence/user.repository";
import type { Profile, TokenPair } from "./auth.types";
import { AuthJwtService } from "./auth-jwt.service";
import { AuthValidationService } from "./auth-validation.service";
import type {
  RegisterRequestDto,
  UpdateProfileRequestDto,
} from "./dto/auth-request.dto";
import { ProfileMapper } from "./mappers/profile.mapper";

const DUMMY_PASSWORD_HASH =
  "$2b$10$tb0zt0DLbpe5sjkDT2q8Cu6jZeUZhCeDHl/nHLNsUxkKa3tvmpbZq";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly sessions: SessionService,
    private readonly otpStore: OtpStore,
    private readonly jwt: AuthJwtService,
    private readonly validation: AuthValidationService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    @Optional()
    @Inject(OTP_SENDER)
    private readonly otpSender: OtpSender | null,
  ) {}

  async onModuleInit() {
    await this.ensureSuperAdmin();
  }

  async register(params: RegisterRequestDto): Promise<TokenPair> {
    this.validation.validatePhone(params.phone);
    this.validation.validatePassword(params.password);
    if (params.email) {
      this.validation.validateEmail(params.email);
    }
    const phone = this.normalizePhone(params.phone);
    const user = await catchPostgres(
      async () =>
        this.users.create({
          phone,
          passwordHash: await hashPassword(params.password),
          firstName: params.first_name,
          lastName: params.last_name,
          email: params.email,
          province: params.province,
          city: params.city,
          address: params.address,
          role: "user",
        }),
      {
        unique: AppException.invalidInput("phone already registered"),
      },
    );
    return this.issueTokens(user.id, user.phone);
  }

  async loginWithPassword(phone: string, password: string): Promise<TokenPair> {
    this.validation.validatePhone(phone);
    const user = await this.users.findByPhone(this.normalizePhone(phone));
    const ok = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !ok) {
      throw AppException.invalidCredentials();
    }
    if (!user.isActive) {
      throw AppException.userInactive();
    }
    return this.issueTokens(user.id, user.phone);
  }

  async requestOtp(phone: string): Promise<string | undefined> {
    this.validation.validatePhone(phone);
    return this.issueOtp("login", phone);
  }

  async verifyOtp(phone: string, code: string): Promise<TokenPair> {
    this.validation.validatePhone(phone);
    const normalized = this.normalizePhone(phone);
    await this.consumeOtp("login", normalized, code);

    const user = await this.findOrRegisterByPhone(normalized);
    if (!user.isActive) {
      throw AppException.userInactive();
    }
    return this.issueTokens(user.id, user.phone);
  }

  async requestPasswordOtp(phone: string): Promise<string | undefined> {
    this.validation.validatePhone(phone);
    return this.issueOtp("pwd", phone);
  }

  async verifyPasswordOtp(
    phone: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    this.validation.validatePhone(phone);
    this.validation.validatePassword(newPassword);
    const normalized = this.normalizePhone(phone);
    await this.consumeOtp("pwd", normalized, code);
    const user = await this.users.findByPhone(normalized);
    if (!user) {
      throw AppException.notFound("user not found");
    }
    await this.users.updatePassword(user.id, await hashPassword(newPassword));
    await this.sessions.revokeByUser(user.id);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const claims = await this.verifyRefreshToken(refreshToken);
    const user = await this.users.findById(claims.user_id);
    if (!user) {
      throw AppException.notFound("user not found");
    }
    if (!user.isActive) {
      throw AppException.userInactive();
    }
    await this.sessions.revokeByRefreshToken(refreshToken);
    return this.issueTokens(claims.user_id, claims.phone);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessions.revokeByRefreshToken(refreshToken);
  }

  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (oldPassword === newPassword) {
      throw AppException.passwordSame();
    }
    this.validation.validatePassword(newPassword);
    const user = await this.users.findById(userId);
    if (!user) {
      throw AppException.notFound("user not found");
    }
    if (!(await verifyPassword(oldPassword, user.passwordHash))) {
      throw AppException.invalidCredentials();
    }
    await this.users.updatePassword(user.id, await hashPassword(newPassword));
    await this.sessions.revokeByUser(user.id);
  }

  async updateProfile(
    userId: number,
    params: UpdateProfileRequestDto,
  ): Promise<void> {
    if (params.email) {
      this.validation.validateEmail(params.email);
    }
    await this.users.updateProfile(userId, {
      firstName: emptyToNull(params.first_name),
      lastName: emptyToNull(params.last_name),
      email: emptyToNull(params.email),
      province: emptyToNull(params.province),
      city: emptyToNull(params.city),
      address: emptyToNull(params.address),
    });
  }

  async getProfile(userId: number): Promise<Profile> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw AppException.notFound("user not found");
    }
    const permissions = await this.roles.listPermissionRefs(user.role);
    return ProfileMapper.toResponse(user, permissions);
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<{ user_id: number; phone: string }> {
    const session = await this.sessions.findByRefreshToken(refreshToken);
    if (!session || session.revokedAt) {
      throw AppException.sessionInvalid("invalid refresh token");
    }
    if (Date.now() > session.expiresAt.getTime()) {
      throw AppException.sessionInvalid("refresh token expired");
    }
    try {
      return await this.jwt.parseRefresh(refreshToken);
    } catch {
      throw AppException.sessionInvalid("invalid refresh token");
    }
  }

  private async findOrRegisterByPhone(phone: string) {
    const existing = await this.users.findByPhone(phone);
    if (existing) {
      return existing;
    }
    return this.users.create({
      phone,
      passwordHash: await hashPassword(this.randomPassword()),
      role: "user",
    });
  }

  private async issueOtp(
    scope: string,
    phone: string,
  ): Promise<string | undefined> {
    const normalized = this.normalizePhone(phone);
    const code = generateNumericOtp(
      this.config.get("OTP_DIGITS", { infer: true }),
    );
    try {
      if (this.otpSender) {
        const pattern =
          this.config.get("IPPANEL_AUTH_PATTERN", { infer: true }) ?? "";
        await this.otpSender.sendOtp(pattern, normalized, code);
      }
      await this.otpStore.set(
        this.otpKey(scope, normalized),
        sha256Hex(code),
        this.config.get("OTP_TTL_SECONDS", { infer: true }),
      );
    } catch (error) {
      this.logger.error("otp issue failed", error as Error);
      throw AppException.invalidInput("otp issue failed");
    }
    return this.exposeOtpCode() ? code : undefined;
  }

  private async issueTokens(userId: number, phone: string): Promise<TokenPair> {
    const pair = await this.jwt.generatePair(userId, phone);
    const refreshTtlDays = this.config.get("JWT_REFRESH_TTL_DAYS", {
      infer: true,
    });
    try {
      await this.sessions.create({
        userId,
        refreshToken: pair.refresh_token,
        accessToken: pair.access_token,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return this.issueTokens(userId, phone);
      }
      throw error;
    }
    return pair;
  }

  private async ensureSuperAdmin() {
    const phone = this.config.get("SUPERADMIN_PHONE", { infer: true }).trim();
    const password = this.config.get("SUPERADMIN_PASSWORD", { infer: true });
    if (!phone || !password) {
      return;
    }
    try {
      if (await this.users.findByPhone(phone)) {
        return;
      }
      await this.users.create({
        phone,
        passwordHash: await hashPassword(password),
        role: "superadmin",
      });
      this.logger.log("superadmin user ensured");
    } catch (error) {
      this.logger.warn(
        `ensure superadmin skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async consumeOtp(
    scope: string,
    phone: string,
    code: string,
  ): Promise<void> {
    const key = this.otpKey(scope, phone);
    const attemptsKey = `${key}:attempts`;
    const stored = await this.otpStore.get(key);
    if (!stored || !sha256EqualsHex(code, stored)) {
      const attempts = await this.otpStore.increment(
        attemptsKey,
        this.config.get("OTP_TTL_SECONDS", { infer: true }),
      );
      if (attempts >= this.config.get("OTP_MAX_ATTEMPTS", { infer: true })) {
        await this.otpStore.delete(key);
        await this.otpStore.delete(attemptsKey);
        throw AppException.rateLimited("otp locked");
      }
      throw AppException.invalidOtp();
    }
    await this.otpStore.delete(key);
    await this.otpStore.delete(attemptsKey);
  }

  private exposeOtpCode(): boolean {
    return (
      this.config.get("OTP_SMS_DEBUG_ENABLED", { infer: true }) ||
      !this.config.get("OTP_SMS_ENABLED", { infer: true })
    );
  }

  private randomPassword(): string {
    return `otp:${randomBytes(8).toString("hex")}`;
  }

  private otpKey(scope: string, phone: string): string {
    return `otp:${scope}:${phone}`;
  }

  private normalizePhone(phone: string): string {
    return phone.trim();
  }
}
