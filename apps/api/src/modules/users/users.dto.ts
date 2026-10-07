import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @Matches(/^\d{10}$/) nationalCode?: string | null;
  @IsOptional() @IsString() birthDate?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) address?: string | null;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string | null;
}
export class AssignOrganizationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) departmentId?:
    | number
    | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) accessLevelId?:
    | number
    | null;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string | null;
}
export class UpdateRoleDto {
  @IsIn(["admin", "user"]) role!: "admin" | "user";
}
