import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../../../common/decorators/current-user.decorator";
import {
  ApiErrors,
  ApiMessageEnvelope,
  ApiResourceEnvelope,
  Err,
  MessageResults,
  otpResult,
  withAuth,
  withPublic,
} from "../../../../../common/http/index";
import { PROFILE_PERMISSIONS } from "./auth.permissions";
import { AuthService } from "./auth.service";
import type { AuthUser } from "./auth.types";
import { Permissions } from "./decorators/permissions.decorator";
import { Public } from "./decorators/public.decorator";
import {
  ChangePasswordRequestDto,
  LoginRequestDto,
  OtpPasswordVerifyRequestDto,
  OtpRequestDto,
  OtpVerifyRequestDto,
  RefreshTokenDto,
  RegisterRequestDto,
  UpdateProfileRequestDto,
} from "./dto/auth-request.dto";
import {
  OtpIssuedDto,
  ProfileDto,
  TokenPairDto,
} from "./dto/auth-response.dto";

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiResourceEnvelope(TokenPairDto, 201, "Registered and signed in")
  @ApiErrors(
    ...withPublic(Err.invalidInput("phone already registered", "phoneTaken")),
  )
  register(@Body() body: RegisterRequestDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiResourceEnvelope(TokenPairDto)
  @ApiErrors(...withPublic(Err.invalidCredentials(), Err.userInactive()))
  login(@Body() body: LoginRequestDto) {
    return this.authService.loginWithPassword(body.phone, body.password);
  }

  @Public()
  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  @ApiResourceEnvelope(OtpIssuedDto)
  @ApiErrors(
    ...withPublic(Err.invalidInput("otp issue failed", "otpIssueFailed")),
  )
  async requestOtp(@Body() body: OtpRequestDto) {
    return otpResult(await this.authService.requestOtp(body.phone));
  }

  @Public()
  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  @ApiResourceEnvelope(TokenPairDto)
  @ApiErrors(
    ...withPublic(
      Err.invalidOtp(),
      Err.userInactive(),
      Err.rateLimited("otp locked", "otpLocked"),
    ),
  )
  verifyOtp(@Body() body: OtpVerifyRequestDto) {
    return this.authService.verifyOtp(body.phone, body.code);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiResourceEnvelope(TokenPairDto)
  @ApiErrors(
    ...withPublic(
      Err.sessionInvalid("invalid refresh token", "invalidRefresh"),
      Err.userInactive(),
    ),
  )
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refresh_token);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiMessageEnvelope("logged_out")
  @ApiErrors(...withPublic())
  async logout(@Body() body: RefreshTokenDto) {
    await this.authService.logout(body.refresh_token);
    return MessageResults.loggedOut();
  }

  @Post("password/change")
  @HttpCode(HttpStatus.OK)
  @Permissions(PROFILE_PERMISSIONS.use)
  @ApiBearerAuth()
  @ApiMessageEnvelope("password_updated")
  @ApiErrors(...withAuth(Err.invalidCredentials(), Err.passwordSame()))
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordRequestDto,
  ) {
    await this.authService.changePassword(
      user.userId,
      body.old_password,
      body.new_password,
    );
    return MessageResults.passwordUpdated();
  }

  @Get("profile")
  @Permissions(PROFILE_PERMISSIONS.use)
  @ApiBearerAuth()
  @ApiResourceEnvelope(ProfileDto)
  @ApiErrors(...withAuth())
  getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.userId);
  }

  @Put("profile")
  @HttpCode(HttpStatus.OK)
  @Permissions(PROFILE_PERMISSIONS.use)
  @ApiBearerAuth()
  @ApiMessageEnvelope("profile_updated")
  @ApiErrors(...withAuth())
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateProfileRequestDto,
  ) {
    await this.authService.updateProfile(user.userId, body);
    return MessageResults.profileUpdated();
  }

  @Public()
  @Post("password/otp/request")
  @HttpCode(HttpStatus.OK)
  @ApiResourceEnvelope(OtpIssuedDto)
  @ApiErrors(
    ...withPublic(Err.invalidInput("otp issue failed", "otpIssueFailed")),
  )
  async requestPasswordOtp(@Body() body: OtpRequestDto) {
    return otpResult(await this.authService.requestPasswordOtp(body.phone));
  }

  @Public()
  @Post("password/otp/verify")
  @HttpCode(HttpStatus.OK)
  @ApiMessageEnvelope("password_updated")
  @ApiErrors(
    ...withPublic(
      Err.invalidOtp(),
      Err.rateLimited("otp locked", "otpLocked"),
      Err.notFound("user not found"),
    ),
  )
  async verifyPasswordOtp(@Body() body: OtpPasswordVerifyRequestDto) {
    await this.authService.verifyPasswordOtp(
      body.phone,
      body.code,
      body.new_password,
    );
    return MessageResults.passwordUpdated();
  }

  @Public()
  @Post("forgot/phone/request")
  @HttpCode(HttpStatus.OK)
  @ApiResourceEnvelope(OtpIssuedDto)
  @ApiErrors(
    ...withPublic(Err.invalidInput("otp issue failed", "otpIssueFailed")),
  )
  async requestForgotPhoneOtp(@Body() body: OtpRequestDto) {
    return otpResult(await this.authService.requestPasswordOtp(body.phone));
  }

  @Public()
  @Post("forgot/phone/verify")
  @HttpCode(HttpStatus.OK)
  @ApiMessageEnvelope("password_updated")
  @ApiErrors(
    ...withPublic(
      Err.invalidOtp(),
      Err.rateLimited("otp locked", "otpLocked"),
      Err.notFound("user not found"),
    ),
  )
  async verifyForgotPhoneOtp(@Body() body: OtpPasswordVerifyRequestDto) {
    await this.authService.verifyPasswordOtp(
      body.phone,
      body.code,
      body.new_password,
    );
    return MessageResults.passwordUpdated();
  }
}
