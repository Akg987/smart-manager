import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class AiChatDto {
  @IsString() @MaxLength(12000) question!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) companyId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) conversationId?: number;
  @IsOptional() @IsString() @MaxLength(10) period?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) comparisonPeriods?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  comparisonCompanyIds?: number[];
}

export class ReviewAiRecommendationDto {
  @IsString() @MaxLength(16) decision!: "accepted" | "rejected";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) ownerUserId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) approverUserId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) departmentId?: number;
  @IsOptional() @IsString() @MaxLength(10) dueAt?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
