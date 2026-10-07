import { HttpStatus } from "@nestjs/common";
import { AppException } from "../../common/http/app.exception";
import { AuthValidationService } from "./auth-validation.service";

describe("AuthValidationService", () => {
	const validation = new AuthValidationService();

	it("accepts an Iranian mobile number", () => {
		expect(() => validation.validatePhone("09123456789")).not.toThrow();
	});

	it("rejects a non-Iranian phone", () => {
		expect(() => validation.validatePhone("+989123456789")).toThrow(
			AppException,
		);
		try {
			validation.validatePhone("0912345678");
		} catch (error) {
			expect(error).toBeInstanceOf(AppException);
			expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
		}
	});

	it("requires upper, lower, and digit in passwords", () => {
		expect(() => validation.validatePassword("Abcdefg1")).not.toThrow();
		expect(() => validation.validatePassword("abcdefgh1")).toThrow(
			AppException,
		);
		expect(() => validation.validatePassword("ABCDEFGH1")).toThrow(
			AppException,
		);
		expect(() => validation.validatePassword("Abcdefgh")).toThrow(AppException);
	});
});
