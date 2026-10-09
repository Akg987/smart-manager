import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  Max,
  Min,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
export class CreateActionDto {
  @Type(() => Number) @IsNumber() departmentId!: number;
  @IsOptional() @Type(() => Number) @IsNumber() alertId?: number | null;
  @IsString() @MaxLength(240) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MaxLength(240) successMetric!: string;
  @IsOptional() @Type(() => Number) @IsNumber() baseline?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() target?: number | null;
  @Type(() => Number) @IsNumber() ownerUserId!: number;
  @Type(() => Number) @IsNumber() approverUserId!: number;
  @IsString() priority!: string;
  @IsString() dueAt!: string;
}
export class ActionStatusDto {
  @IsIn([
    "approved",
    "in_progress",
    "blocked",
    "pending_completion_approval",
    "closed",
    "canceled",
  ])
  status!:
    | "approved"
    | "in_progress"
    | "blocked"
    | "pending_completion_approval"
    | "closed"
    | "canceled";
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class ActionAssignmentDto {
  @Type(() => Number) @IsNumber() ownerUserId!: number;
  @IsString() dueAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class ActionProgressDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) progress!: number;
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class ResolveAlertDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class ActionPriorityDto {
  @IsString() @MaxLength(80) name!: string;
}
