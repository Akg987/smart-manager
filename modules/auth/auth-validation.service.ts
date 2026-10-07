import { Injectable } from "@nestjs/common";
import { AppException } from "../../common/http/app.exception";

const PHONE_RE = /^09\d{9}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;

@Injectable()
export class AuthValidationService {
	validatePhone(phone: string) {
		if (!PHONE_RE.test(phone.trim())) {
			throw AppException.invalidInput("invalid phone format");
		}
	}

	validateEmail(email: string) {
		if (!EMAIL_RE.test(email.trim())) {
			throw AppException.invalidInput("invalid email format");
		}
	}

	validatePassword(password: string) {
		if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
			throw AppException.invalidInput(
				`password length must be between ${PASSWORD_MIN} and ${PASSWORD_MAX}`,
			);
		}
		if (!/[A-Z]/.test(password)) {
			throw AppException.invalidInput(
				"password must include an uppercase letter",
			);
		}
		if (!/[a-z]/.test(password)) {
			throw AppException.invalidInput(
				"password must include a lowercase letter",
			);
		}
		if (!/\d/.test(password)) {
			throw AppException.invalidInput("password must include a digit");
		}
	}
}
