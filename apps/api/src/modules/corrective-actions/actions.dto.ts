import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
export class CreateActionDto {
	@Type(() => Number) @IsNumber() departmentId!: number;
	@IsOptional() @Type(() => Number) @IsNumber() alertId?: number | null;
	@IsString() @MaxLength(240) title!: string;
	@IsOptional() @IsString() @MaxLength(2000) description?: string;
	@IsString() @MaxLength(240) successMetric!: string;
	@Type(() => Number) @IsNumber() ownerUserId!: number;
	@IsString() priority!: string;
	@IsString() dueAt!: string;
}
export class ActionStatusDto { @IsIn(["open", "in_progress", "blocked", "done"]) status!: "open" | "in_progress" | "blocked" | "done"; }
export class ResolveAlertDto { @IsOptional() @IsString() @MaxLength(1000) note?: string; }
export class ActionPriorityDto { @IsString() @MaxLength(80) name!: string; }
