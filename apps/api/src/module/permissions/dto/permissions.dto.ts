import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export class PermissionRefDto {
  @ApiProperty({ example: "orders" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiProperty({ example: "manage" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  action: string;
}

export class PermissionDto extends PermissionRefDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiPropertyOptional({ example: "Manage orders" })
  description?: string;

  @ApiProperty({ example: "2026-09-13T18:00:00Z" })
  created_at: string;

  @ApiProperty({ example: "2026-09-13T18:00:00Z" })
  updated_at: string;
}
