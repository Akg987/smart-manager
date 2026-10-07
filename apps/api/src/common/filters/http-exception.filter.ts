import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { I18nService } from "../i18n/i18n.service.js";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const locale = this.i18n.localeFromRequest(request);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : this.i18n.t("INTERNAL_ERROR", locale);
    const body =
      typeof raw === "string"
        ? { message: raw }
        : (raw as Record<string, unknown>);
    const message = this.i18n.t(
      typeof body.message === "string"
        ? body.message
        : status >= 500
          ? "INTERNAL_ERROR"
          : "REQUEST_FAILED",
      locale,
    );
    const errors = this.i18n.translateErrors(
      body.errors as Record<string, string[]> | undefined,
      locale,
    );
    reply.status(status).send({
      success: false,
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
