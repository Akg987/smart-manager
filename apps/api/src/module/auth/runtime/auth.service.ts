import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { randomInt } from "node:crypto";
import { jalaliDateToGregorian } from "../../../shared/jalali.js";
import { type OtpPurpose } from "../../../../../../src/db/schema.js";
import { SmsIppanelHubService } from "../../sms-ippanel-hub/sms-ippanel-hub.service.js";
import { AuthRepository } from "./auth.repository.js";
import { hashInvitationToken } from "../../tenant-admin/invitation-security.js";
import { SMART_MANAGER_PERMISSION_KEYS } from "../../permissions/smart-manager-catalog.js";
import {
  grantCoversResource,
  type SmartManagerAuthContext,
  type SmartManagerGrant,
} from "../../permissions/smart-manager-authorization.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly auth: AuthRepository,
    private readonly sms: SmsIppanelHubService,
  ) {}

  async effectivePermissions(
    context: SmartManagerAuthContext,
  ): Promise<string[]> {
    const grants: SmartManagerGrant[] =
      await this.auth.effectivePermissionGrants(context);
    const resource = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: context.businessUnitId,
      ownerId: context.userId,
      assignedUserId: context.userId,
    };
    return SMART_MANAGER_PERMISSION_KEYS.filter((permission) =>
      grants.some(
        (grant) =>
          grant.permission === permission &&
          grantCoversResource(context, grant, {
            ...resource,
            domain: grant.scopeType === "domain" ? grant.domain : null,
          }),
      ),
    );
  }

  static requiresTwoFactor(
    enabled: boolean,
    roles: readonly string[],
    userRole: string,
    transportAvailable: boolean,
    failOpen: boolean,
  ): boolean {
    return (
      enabled && roles.includes(userRole) && (transportAvailable || !failOpen)
    );
  }

  /** Laravel Hash::check uses bcrypt; bcryptjs understands Laravel's $2y$ prefix. */
  async validatePassword(
    plainText: string,
    storedHash: string,
  ): Promise<boolean> {
    if (!/^\$2[aby]\$\d\d\$/.test(storedHash)) return false;
    return compare(plainText, storedHash.replace(/^\$2y\$/, "$2b$"));
  }

  async register(
    input: {
      mobile: string;
      password: string;
      firstName: string;
      lastName: string;
      nationalCode: string;
      birthDate: string;
      address: string;
      invitationToken?: string;
    },
    requiresApproval: boolean,
  ) {
    const birthDate = jalaliDateToGregorian(input.birthDate);
    if (!birthDate) throw new BadRequestException("Invalid Jalali birth date.");
    const { invitationToken, ...userInput } = input;
    const result = await this.auth.registerUser(
      {
        ...userInput,
        birthDate,
        password: await hash(input.password, 10),
        role: "user",
        approvedAt: requiresApproval ? null : new Date(),
      },
      invitationToken ? hashInvitationToken(invitationToken) : undefined,
    );
    if ("missingTenant" in result)
      throw new ServiceUnavailableException(
        "Default tenant is not configured.",
      );
    if ("invalidInvitation" in result)
      throw new BadRequestException(
        "Invitation is invalid, expired, revoked, or belongs to another mobile number.",
      );
    return result;
  }

  async authenticate(mobile: string, password: string) {
    const [user] = await this.auth.findUserByMobile(mobile);
    if (!user || !(await this.validatePassword(password, user.password)))
      throw new UnauthorizedException("Invalid credentials.");
    if (!user.approvedAt)
      throw new UnauthorizedException("Account approval is pending.");
    return user;
  }

  async provisionFirstAdmin(mobile: string, password: string) {
    const admin = await this.auth.provisionFirstAdmin(
      mobile,
      await hash(password, 10),
    );
    if (!admin)
      throw new BadRequestException(
        "Initial setup has already been completed.",
      );
    return admin;
  }

  async createOtp(input: {
    purpose: OtpPurpose;
    identifier: string;
    code: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const result = await this.auth.createOtp({
      purpose: input.purpose,
      identifier: input.identifier,
      codeHash: await hash(input.code, 10),
      now,
    });
    if (result.tooSoon)
      throw new HttpException(
        "Wait before requesting another code.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return result.challenge;
  }

  /** Persist a hashed challenge, then deliver its plaintext code through the configured IPPanel pattern. */
  async issueOtp(input: {
    purpose: OtpPurpose;
    identifier: string;
    now?: Date;
  }) {
    const patternCode = process.env.IPPANEL_OTP_PATTERN_CODE?.trim();
    if (!patternCode)
      throw new ServiceUnavailableException(
        "IPPANEL_OTP_PATTERN_CODE is required to deliver OTP messages.",
      );
    const code = String(randomInt(100_000, 1_000_000));
    const challenge = await this.createOtp({ ...input, code });
    await this.sms.sendOtp(patternCode, input.identifier, code);
    return { sent: true, expiresAt: challenge.expiresAt };
  }

  consumeOtp(
    purpose: OtpPurpose,
    identifier: string,
    code: string,
    now = new Date(),
  ): Promise<boolean> {
    return this.auth.consumeOtp(purpose, identifier, code, now);
  }

  async resetPassword(mobile: string, token: string, newPassword: string) {
    const result = await this.auth.resetPassword(
      mobile,
      token,
      await hash(newPassword, 10),
    );
    if ("invalid" in result)
      throw new UnauthorizedException("Invalid or expired reset token.");
    if ("missing" in result)
      throw new BadRequestException("Account not found.");
    return result.user;
  }

  async resetPasswordWithOtp(
    mobile: string,
    code: string,
    newPassword: string,
  ) {
    const result = await this.auth.resetPasswordWithOtp(
      mobile,
      code,
      await hash(newPassword, 10),
      new Date(),
    );
    if ("invalid" in result)
      throw new UnauthorizedException("Invalid or expired verification code.");
    if ("missing" in result)
      throw new BadRequestException("Account not found.");
    return result.user;
  }
}
