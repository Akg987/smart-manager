import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module.js";
import { ValidationExceptionFilter } from "./common/validation-exception.filter.js";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import type { ValidationError } from "class-validator";

config();
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), "../../.env.local") });

function errorsByField(errors: ValidationError[], parent = ""): Record<string, string[]> {
	return errors.reduce<Record<string, string[]>>((result, error) => {
		const field = parent ? `${parent}.${error.property}` : error.property;
		const messages = Object.values(error.constraints ?? {});
		if (messages.length) result[field] = messages;
		Object.assign(result, errorsByField(error.children ?? [], field));
		return result;
	}, {});
}

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const allowedOrigin = process.env.WEB_ORIGIN;
	app.enableCors({ origin: allowedOrigin || false, credentials: true });
	app.use((request: Request, _response: Response, next: NextFunction) => {
		const cookieHeader = request.headers.cookie ?? "";
		request.cookies = Object.fromEntries(cookieHeader.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
			const [key, ...value] = part.split("=");
			try { return [decodeURIComponent(key), decodeURIComponent(value.join("="))]; } catch { return [key, value.join("=")]; }
		}));
		next();
	});
	app.setGlobalPrefix("api");
	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, exceptionFactory: (validationErrors) => new BadRequestException({ message: "Validation failed.", errors: errorsByField(validationErrors) }) }));
	app.useGlobalFilters(new ValidationExceptionFilter());
	await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");
}

void bootstrap();
