import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class DerivedKpiDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MaxLength(2000) formula!: string;
  @IsString() @MaxLength(80) unit!: string;
  @IsString() @MaxLength(32) periodType!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) businessUnitId?:
    | number
    | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) ownerUserId?:
    | number
    | null;
  @IsOptional() @Type(() => Number) @IsNumber() targetValue?: number | null;
}

export class UpdateDerivedKpiDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) formula?: string;
  @IsOptional() @IsString() @MaxLength(80) unit?: string;
  @IsOptional() @IsString() @MaxLength(32) periodType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) businessUnitId?:
    | number
    | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) ownerUserId?:
    | number
    | null;
  @IsOptional() @Type(() => Number) @IsNumber() targetValue?: number | null;
}

export class FormulaValidateDto {
  @IsString() @MaxLength(2000) formula!: string;
  @IsString() @MaxLength(80) unit!: string;
  @IsString() @MaxLength(32) periodType!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) businessUnitId?:
    | number
    | null;
  @IsOptional() @IsObject() options?: Record<string, unknown>;
}

export class CalculateDerivedKpiDto {
  @IsString() @MaxLength(10) period!: string;
}
