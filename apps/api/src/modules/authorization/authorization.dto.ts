import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { knownPermissions } from "./authorization.service.js";

export class AccessLevelDto {
	@IsString() @IsNotEmpty() @MaxLength(120) name!: string;
	@IsOptional() @Transform(({ value }) => value === "" || value === undefined || value === null ? null : Number(value)) @IsInt() @Min(1) departmentId?: number | null;
	@IsOptional() @IsArray() @ArrayMaxSize(80) @IsString({ each: true }) @IsIn(knownPermissions, { each: true }) permissions?: string[];
}

export class RolePermissionsDto {
	@IsArray() @ArrayMaxSize(80) @IsString({ each: true }) @IsIn(knownPermissions, { each: true }) permissions!: string[];
}
