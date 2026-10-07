import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { resolveLocale, translations, type AppLocale } from "./messages.js";

@Injectable()
export class I18nService {
  localeFromRequest(request: FastifyRequest): AppLocale {
    return resolveLocale(request.headers["accept-language"]);
  }

  t(key: string | undefined, locale: AppLocale): string {
    if (!key) return translations.REQUEST_FAILED[locale];
    return translations[key]?.[locale] ?? key;
  }

  translateErrors(
    errors: Record<string, string[]> | undefined,
    locale: AppLocale,
  ) {
    if (!errors) return undefined;
    return Object.fromEntries(
      Object.entries(errors).map(([field, messages]) => [
        field,
        messages.map((message) => this.t(message, locale)),
      ]),
    );
  }
}
