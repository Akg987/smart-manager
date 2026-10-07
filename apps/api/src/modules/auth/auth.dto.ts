import { Transform } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { normalizeDigits } from "../../shared/normalize-input.js";

export class LoginDto {
	@Transform(({ value }) => normalizeDigits(value)) @Matches(/^09\d{9}$/) mobile!: string;
	@IsString() @IsNotEmpty() @MaxLength(128) password!: string;
	@IsOptional() @IsBoolean() remember?: boolean;
}

export class SetupDto extends LoginDto { @IsString() @MinLength(8) @MaxLength(72) password_confirmation!: string; }

export class RegisterDto {
	@Transform(({ value }) => normalizeDigits(value)) @Matches(/^09\d{9}$/) mobile!: string;
	@IsString() @MinLength(8) @MaxLength(72) password!: string;
	@IsString() @MinLength(8) @MaxLength(72) password_confirmation!: string;
	@IsString() @IsNotEmpty() @MaxLength(100) first_name!: string;
	@IsString() @IsNotEmpty() @MaxLength(100) last_name!: string;
	@Transform(({ value }) => normalizeDigits(value)) @Matches(/^\d{10}$/) national_code!: string;
	@Transform(({ value }) => normalizeDigits(value)) @IsString() @IsNotEmpty() birth_date!: string;
	@IsString() @MaxLength(2000) address!: string;
}

export class OtpRequestDto { @Transform(({ value }) => normalizeDigits(value)) @Matches(/^09\d{9}$/) mobile!: string; }
export class OtpVerifyDto extends OtpRequestDto { @Transform(({ value }) => normalizeDigits(value)) @Matches(/^\d{4,8}$/) code!: string; }
export class TwoFactorCodeDto { @Transform(({ value }) => normalizeDigits(value)) @Matches(/^\d{4,8}$/) code!: string; }
export class ResetPasswordDto extends OtpVerifyDto {
	@IsString() @MinLength(8) @MaxLength(72) password!: string;
	@IsString() @MinLength(8) @MaxLength(72) password_confirmation!: string;
}
