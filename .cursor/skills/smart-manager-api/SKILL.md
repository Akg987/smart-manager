---
name: smart-manager-api
description: NestJS Fastify API conventions for Smart Manager (MVCRS, repositories, interceptors, i18n, Swagger). Use when changing apps/api, controllers, services, sessions, or API error responses.
---

# Smart Manager API

## Layout

- Controllers: HTTP + DTO validation
- Services: business rules
- Repositories: Drizzle access (`extends BaseRepository`)
- DTOs: request/response models

## Runtime

- Bootstrap is Fastify in `src/main.ts` (`cookie`, `helmet`, `multipart`, Swagger at `/api/docs`).
- Global filter: `HttpExceptionFilter`
- Global interceptor: `TransformInterceptor`
- Locale comes from `Accept-Language` (`fa` default, `en` when the header starts with `en`)

## New endpoints

1. Add DTO with `class-validator`.
2. Put queries in a repository.
3. Throw `HttpException` with English source strings that exist in `common/i18n/messages.ts`.
4. Do not send raw Express objects. Use Fastify `FastifyRequest` / `FastifyReply`.
5. For cookies, use `setCookie` / `clearCookie` via `SessionService`.
