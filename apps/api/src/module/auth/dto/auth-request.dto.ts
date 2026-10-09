import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class PhoneDto {
  @ApiProperty({ example: "09123456789" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class ProfileFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class LoginRequestDto extends PhoneDto {
  @ApiProperty({ description: "Account password" })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterRequestDto extends ProfileFieldsDto {
  @ApiProperty({ example: "09123456789", description: "Iranian mobile phone" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: "Password matching configured complexity rules",
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class OtpRequestDto extends PhoneDto {}

export class OtpVerifyRequestDto extends PhoneDto {
  @ApiProperty({ example: "1234" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ChangePasswordRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  old_password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  new_password: string;
}

export class OtpPasswordVerifyRequestDto extends OtpVerifyRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  new_password: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token issued at login or OTP verify",
  })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class UpdateProfileRequestDto extends ProfileFieldsDto {}
