import "reflect-metadata";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

function loadEnv() {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    for (const name of [".env", ".env.local"]) {
      const file = resolve(dir, name);
      if (existsSync(file)) config({ path: file, override: false });
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
}

loadEnv();

Object.defineProperty(BigInt.prototype, "toJSON", {
  configurable: true,
  value(this: bigint) {
    return this.toString();
  },
});

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );
  await app.register(cookie as never);
  await app.register(helmet as never, { contentSecurityPolicy: false });
  await app.register(multipart as never, { limits: { fileSize: 1_048_576 } });
  const allowedOrigin = process.env.WEB_ORIGIN;
  app.enableCors({ origin: allowedOrigin || false, credentials: true });
  app.setGlobalPrefix("api");
  const swagger = new DocumentBuilder()
    .setTitle("Smart Manager API")
    .setDescription("NestJS Fastify API for Smart Manager")
    .setVersion("0.1.0")
    .addCookieAuth("smart_manager_session")
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, swagger),
  );
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`API listening on http://localhost:${port}`);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
