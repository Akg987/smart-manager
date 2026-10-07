import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply, FastifyRequest } from "fastify";
import { map } from "rxjs";
import { SKIP_RESPONSE_WRAP } from "../decorators/skip-response-wrap.decorator.js";
import { I18nService } from "../i18n/i18n.service.js";

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly i18n: I18nService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAP, [
      context.getHandler(),
      context.getClass(),
    ]);
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (skip) return next.handle();
    const locale = this.i18n.localeFromRequest(request);
    return next.handle().pipe(
      map((data) => {
        if (reply.sent || data === undefined) return data;
        const message =
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          "message" in data &&
          typeof data.message === "string"
            ? this.i18n.t(data.message, locale)
            : this.i18n.t("SUCCESS", locale);
        const envelope = {
          success: true,
          statusCode: reply.statusCode,
          message,
          data,
        };
        if (data && typeof data === "object" && !Array.isArray(data))
          return { ...envelope, ...data, message };
        return envelope;
      }),
    );
  }
}
