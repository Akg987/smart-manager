import {
  BadRequestException,
  Global,
  Module,
  ValidationPipe,
} from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { I18nService } from "../common/i18n/i18n.service.js";
import { HttpExceptionFilter } from "../common/filters/http-exception.filter.js";
import { TransformInterceptor } from "../common/interceptors/transform.interceptor.js";
import { errorsByField } from "../common/validation.js";

@Global()
@Module({
  providers: [
    I18nService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (validationErrors) =>
          new BadRequestException({
            message: "Validation failed.",
            errors: errorsByField(validationErrors),
          }),
      }),
    },
  ],
  exports: [I18nService],
})
export class CoreModule {}
