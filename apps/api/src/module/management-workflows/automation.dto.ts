import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class EscalationLevelDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) level!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  roleKeys!: string[];
  @Type(() => Number) @IsInt() @Min(0) afterMinutes!: number;
}

export class CreateEscalationRuleDto {
  @IsIn([
    "severity",
    "amount",
    "duration",
    "delay",
    "missing_data",
    "no_response",
  ])
  trigger!:
    | "severity"
    | "amount"
    | "duration"
    | "delay"
    | "missing_data"
    | "no_response";
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EscalationLevelDto)
  levels!: EscalationLevelDto[];
}

export class UpdateEscalationRuleDto {
  @IsOptional()
  @IsIn([
    "severity",
    "amount",
    "duration",
    "delay",
    "missing_data",
    "no_response",
  ])
  trigger?:
    | "severity"
    | "amount"
    | "duration"
    | "delay"
    | "missing_data"
    | "no_response";
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EscalationLevelDto)
  levels?: EscalationLevelDto[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class ReminderPolicyDto {
  @IsIn(["action", "decision"]) itemType!: "action" | "decision";
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(-525600, { each: true })
  @Max(525600, { each: true })
  offsetsMinutes!: number[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class AutomationRunDto {
  @IsOptional() @IsString() @MaxLength(10) period?: string;
}
