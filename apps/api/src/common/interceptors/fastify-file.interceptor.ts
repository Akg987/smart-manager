import {
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  type NestInterceptor,
  type Type,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AppRequest } from "../http.js";

export function FastifyFileInterceptor(
  field = "avatar",
): Type<NestInterceptor> {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    async intercept(context: ExecutionContext, next: CallHandler) {
      const request = context
        .switchToHttp()
        .getRequest<FastifyRequest & AppRequest>();
      if (typeof request.file === "function") {
        const file = await request.file();
        if (file && file.fieldname === field) {
          const fields: Record<string, string> = {};
          for (const [name, value] of Object.entries(file.fields ?? {})) {
            if (
              typeof value === "object" &&
              value !== null &&
              "value" in value &&
              typeof value.value !== "object"
            )
              fields[name] = String(value.value ?? "");
          }
          request.uploadedFile = {
            buffer: await file.toBuffer(),
            filename: file.filename,
            mimetype: file.mimetype,
            fields,
          };
        }
      }
      return next.handle();
    }
  }
  return mixin(MixinInterceptor);
}
