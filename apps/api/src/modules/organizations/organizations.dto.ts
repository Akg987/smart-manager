import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
export class DepartmentDto {
	@IsString() @MaxLength(100) name!: string;
	@IsString() @MaxLength(32) code!: string;
	@IsOptional() @Type(() => Number) @IsNumber() managerUserId?: number | null;
}
export class UpdateDepartmentDto {
	@IsOptional() @IsString() @MaxLength(100) name?: string;
	@IsOptional() @IsString() @MaxLength(32) code?: string;
	@IsOptional() @Type(() => Number) @IsNumber() managerUserId?: number | null;
}
