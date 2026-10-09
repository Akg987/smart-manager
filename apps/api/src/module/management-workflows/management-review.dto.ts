import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateManagementReviewDto {
  @IsIn(["wbr", "mbr"]) type!: "wbr" | "mbr";
  @IsString() @MaxLength(10) period!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) businessUnitId?: number;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsObject() sections?: Record<string, unknown>;
}

export class UpdateManagementReviewDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsDateString() scheduledAt?: string | null;
  @IsOptional() @IsObject() sections?: Record<string, unknown>;
}

export class CloseManagementReviewDto {
  @IsString() @MaxLength(3000) closureSummary!: string;
}
