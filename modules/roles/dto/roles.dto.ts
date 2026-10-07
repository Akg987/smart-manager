import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsArray,
	IsNotEmpty,
	IsOptional,
	IsString,
	ValidateNested,
} from "class-validator";
import { PermissionRefDto } from "../../permissions/dto/permissions.dto";

function trimString({ value }: { value: unknown }) {
	return typeof value === "string" ? value.trim() : value;
}

export class CreateRoleDto {
	@ApiProperty({ example: "support" })
	@Transform(trimString)
	@IsString()
	@IsNotEmpty()
	key: string;

	@ApiProperty({ example: "Support" })
	@Transform(trimString)
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiPropertyOptional({ example: "Handles support tickets" })
	@Transform(trimString)
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({ type: [PermissionRefDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PermissionRefDto)
	permissions?: PermissionRefDto[];
}

export class UpdateRoleDto {
	@ApiProperty({ example: "Support" })
	@Transform(trimString)
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiPropertyOptional({ example: "Handles support tickets" })
	@Transform(trimString)
	@IsOptional()
	@IsString()
	description?: string;
}

export class SetRolePermissionsDto {
	@ApiProperty({ type: [PermissionRefDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PermissionRefDto)
	permissions: PermissionRefDto[];
}

export class RolePermissionGrantDto extends PermissionRefDto {
	@ApiProperty({ example: true })
	locked: boolean;
}

export class RoleDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: "seller" })
	key: string;

	@ApiProperty({ example: "Seller" })
	name: string;

	@ApiPropertyOptional({ example: "Store access, orders, and payments" })
	description?: string;

	@ApiProperty({ example: true })
	locked: boolean;

	@ApiProperty({ type: [RolePermissionGrantDto] })
	permissions: RolePermissionGrantDto[];

	@ApiProperty({ example: "2026-09-13T18:00:00Z" })
	created_at: string;

	@ApiProperty({ example: "2026-09-13T18:00:00Z" })
	updated_at: string;
}
