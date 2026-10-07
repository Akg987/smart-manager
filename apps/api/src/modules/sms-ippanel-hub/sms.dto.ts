import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSmsSettingsDto {
	@IsOptional() @IsString() @MaxLength(4096) apiKey?: string;
	@IsString() @MaxLength(32) sender!: string;
}
