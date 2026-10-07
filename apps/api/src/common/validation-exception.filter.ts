import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ValidationExceptionFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
		const raw = exception instanceof HttpException ? exception.getResponse() : "Internal server error.";
		const body = typeof raw === "string" ? { message: raw } : raw as Record<string, unknown>;
		response.status(status).json({ statusCode: status, message: body.message ?? "Request failed.", ...(body.errors ? { errors: body.errors } : {}), path: request.url, timestamp: new Date().toISOString() });
	}
}
