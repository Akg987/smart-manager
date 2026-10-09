import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
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

export const dashboardWidgetTypes = [
  "kpi_card",
  "trend_chart",
  "line_chart",
  "bar_chart",
  "comparison",
  "progress",
  "table",
  "red_flag_list",
  "action_list",
  "decision_list",
  "data_quality",
  "company_scorecard",
] as const;

export class DashboardWidgetDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id?: number;
  @IsIn(dashboardWidgetTypes) type!: (typeof dashboardWidgetTypes)[number];
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsObject() config!: Record<string, unknown>;
  @Type(() => Number) @IsInt() @Min(0) @Max(11) positionX!: number;
  @Type(() => Number) @IsInt() @Min(0) positionY!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) width!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) height!: number;
}

export class CreateDashboardDto {
  @IsString() @MaxLength(160) name!: string;
  @IsIn(["holding", "company", "business_unit", "role", "personal"]) type!:
    | "holding"
    | "company"
    | "business_unit"
    | "role"
    | "personal";
  @IsOptional() @IsIn(["private", "role", "company", "holding"]) visibility?:
    | "private"
    | "role"
    | "company"
    | "holding";
  @IsOptional() @IsString() @MaxLength(80) roleKey?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) businessUnitId?: number;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetDto)
  widgets?: DashboardWidgetDto[];
}

export class UpdateDashboardDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsIn(["private", "role", "company", "holding"]) visibility?:
    | "private"
    | "role"
    | "company"
    | "holding";
  @IsOptional() @IsString() @MaxLength(80) roleKey?: string;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetDto)
  widgets?: DashboardWidgetDto[];
}

export class DuplicateDashboardDto {
  @IsString() @MaxLength(160) name!: string;
}
