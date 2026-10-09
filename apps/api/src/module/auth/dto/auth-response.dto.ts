import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TokenPairDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  access_token: string;

  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  refresh_token: string;
}

export class OtpIssuedDto {
  @ApiPropertyOptional({
    description: "Present only when SMS is disabled or OTP debug is enabled",
    example: "1234",
  })
  debug_code?: string;
}

export class ProfilePermissionDto {
  @ApiProperty({ example: "orders" })
  module: string;

  @ApiProperty({ example: "use" })
  action: string;
}

export class ProfileDto {
  @ApiProperty({ example: "09123456789" })
  phone: string;

  @ApiProperty({ example: "user" })
  role: string;

  @ApiProperty({ type: [ProfilePermissionDto] })
  permissions: ProfilePermissionDto[];

  @ApiPropertyOptional()
  first_name?: string;

  @ApiPropertyOptional()
  last_name?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  province?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  address?: string;
}
