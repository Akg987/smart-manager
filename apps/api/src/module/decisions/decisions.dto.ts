import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateDecisionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) businessUnitId?: number;
  @IsOptional() @IsString() @MaxLength(10) period?: string;
  @IsOptional() @IsString() @MaxLength(250) sourceMeeting?: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) decisionText!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) ownerUserId?:
    | number
    | null;
  @IsDateString() deadline!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  relatedKpiIds?: number[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  actionIds?: number[];
}

export class DecisionOutcomeDto {
  @IsIn([
    "communicated",
    "in_progress",
    "result_review",
    "resolved",
    "closed",
    "rejected",
    "cancelled",
  ])
  status!:
    | "communicated"
    | "in_progress"
    | "result_review"
    | "resolved"
    | "closed"
    | "rejected"
    | "cancelled";
  @IsOptional() @IsString() @MaxLength(5000) outcome?: string;
  @IsOptional() @IsString() @MaxLength(2000) closureEvidence?: string;
}
