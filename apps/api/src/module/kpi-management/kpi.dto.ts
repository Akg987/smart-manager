import { Type } from "class-transformer";
import {
  IsBoolean,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateKpiDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  businessUnitId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(80) domain?: string;

  @IsIn(["higher", "lower", "range"])
  direction!: "higher" | "lower" | "range";

  @Type(() => Number)
  @IsNumber()
  targetValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  warningValue?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  criticalValue?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ownerUserId?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() dataOwnerUserId?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() reviewerUserId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  reporterUserId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  inputMode?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) inputOptions?: string[];

  @IsOptional() @IsString() @MaxLength(160) source?: string;

  @IsOptional() @IsString() @MaxLength(48) formulaType?: string;

  @IsOptional() @IsObject() formulaConfig?: Record<string, unknown> | null;

  @IsOptional() @IsObject() rangeConfig?: {
    minimum: number;
    maximum: number;
  } | null;

  @IsOptional() @IsString() @MaxLength(32) reportingPeriod?: string;

  @IsOptional() @IsString() @MaxLength(10) submissionDeadline?: string | null;

  @IsOptional() @IsString() @MaxLength(10) effectiveFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  frequency?: string;
}

export class UpdateKpiDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(80) domain?: string;

  @IsOptional() @IsString() @MaxLength(80) unit?: string;

  @IsOptional() @IsString() @MaxLength(160) source?: string;

  @IsOptional() @IsString() @MaxLength(64) inputMode?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) inputOptions?: string[];

  @IsOptional() @IsString() @MaxLength(48) formulaType?: string;

  @IsOptional() @IsObject() formulaConfig?: Record<string, unknown> | null;

  @IsOptional() @IsObject() rangeConfig?: {
    minimum: number;
    maximum: number;
  } | null;

  @IsOptional() @IsString() @MaxLength(32) reportingPeriod?: string;

  @IsOptional() @IsString() @MaxLength(10) submissionDeadline?: string | null;

  @IsOptional() @IsString() @MaxLength(10) effectiveFrom?: string;

  @IsOptional() @Type(() => Number) @IsNumber() dataOwnerUserId?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() reporterUserId?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() reviewerUserId?: number | null;

  @IsIn(["higher", "lower", "range"])
  direction!: "higher" | "lower" | "range";

  @Type(() => Number)
  @IsNumber()
  targetValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  warningValue?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  criticalValue?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ownerUserId?: number | null;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SubmitCheckinDto {
  @IsString()
  period!: string;

  @IsOptional()
  actualValue?: unknown;

  @IsOptional()
  @IsIn(["draft", "submitted", "data_submitted", "revised"])
  status?: "draft" | "submitted" | "data_submitted" | "revised";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  blockers?: string;

  @IsOptional()
  @IsObject()
  dataJson?: Record<string, unknown>;

  @IsOptional() @IsString() @MaxLength(80) unit?: string;
}

export class ReviewCheckinDto {
  @IsIn(["approved", "rejected"])
  decision!: "approved" | "rejected";

  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class CreateObservationDto {
  @IsString() @MaxLength(10) period!: string;
  @IsString() @MaxLength(5000) text!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  relatedKpiIds?: number[];
}

export class UpdateRedFlagDto {
  @IsIn(["investigating", "action_required", "resolved", "closed"])
  status!: "investigating" | "action_required" | "resolved" | "closed";
  @IsOptional() @IsString() @MaxLength(2000) suspectedCause?: string;
  @IsOptional() @Type(() => Number) @IsNumber() ownerUserId?: number | null;
  @IsOptional() @IsString() @MaxLength(10) deadline?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) closureEvidence?: string;
  @IsOptional() @IsString() @MaxLength(1000) exceptionReason?: string;
}

export class CreateRedFlagDto {
  @IsString() @MaxLength(2000) description!: string;
  @IsIn(["critical", "high", "medium", "low"]) severity!:
    | "critical"
    | "high"
    | "medium"
    | "low";
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) kpiId?: number | null;
  @IsOptional() @IsString() @MaxLength(10) period?: string;
  @IsOptional() @IsString() @MaxLength(2000) suspectedCause?: string | null;
}

export class CreateRedFlagRuleDto {
  @IsString() @MaxLength(40) trigger!: string;
  @IsIn(["critical", "high", "medium", "low"]) severity!: string;
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) businessUnitId?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) kpiId?: number;
}

export class UpdateRedFlagRuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(["critical", "high", "medium", "low"]) severity?: string;
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
}

export class EvaluateRedFlagRulesDto {
  @IsOptional() @IsString() @MaxLength(10) period?: string;
}
