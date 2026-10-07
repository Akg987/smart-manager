import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
export class CreateKpiDto {
  @Type(() => Number) @IsNumber() @Min(1) departmentId!: number;
  @IsOptional() @IsString() @MaxLength(64) code?: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsIn(["higher", "lower", "range"]) direction!: "higher" | "lower" | "range";
  @Type(() => Number) @IsNumber() targetValue!: number;
  @IsOptional() @Type(() => Number) @IsNumber() warningValue?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() criticalValue?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() ownerUserId?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) reporterUserId?:
    | number
    | null;
  @IsOptional() @IsString() @MaxLength(80) unit?: string;
  @IsOptional() @IsString() @MaxLength(64) inputMode?: string;
  @IsOptional() @IsString() @MaxLength(50) frequency?: string;
}
export class UpdateKpiDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsIn(["higher", "lower", "range"]) direction!: "higher" | "lower" | "range";
  @Type(() => Number) @IsNumber() targetValue!: number;
  @IsOptional() @Type(() => Number) @IsNumber() warningValue?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() criticalValue?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() ownerUserId?: number | null;
  @IsOptional() @IsString() frequency?: string;
  @IsOptional() @Type(() => Number) @IsNumber() weight?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class SubmitCheckinDto {
  @IsString() period!: string;
  @IsOptional() @Type(() => Number) @IsNumber() actualValue?: number | null;
  @IsOptional() @IsIn(["draft", "submitted", "revised"]) status?:
    | "draft"
    | "submitted"
    | "revised";
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @MaxLength(500) blockers?: string;
  @IsOptional() @IsObject() dataJson?: Record<string, unknown>;
}
