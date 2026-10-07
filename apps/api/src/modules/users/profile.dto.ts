import { IsString, Matches, MinLength } from "class-validator";

export class UpdatePasswordDto {
	@IsString() current_password!: string;
	@IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: "The password must include letters and numbers." }) password!: string;
	@IsString() @MinLength(8) password_confirmation!: string;
}
