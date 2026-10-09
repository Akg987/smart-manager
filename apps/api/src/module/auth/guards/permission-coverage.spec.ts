import { readdirSync } from "node:fs";
import { join } from "node:path";
import { METHOD_METADATA } from "@nestjs/common/constants";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

const MODULES_DIR = join(__dirname, "..", "..");

type Handler = (...args: unknown[]) => unknown;

function controllerFiles(): string[] {
  return readdirSync(MODULES_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".controller.ts"))
    .map((file) => join(MODULES_DIR, file));
}

function routeHandlers(controller: Handler): [string, Handler][] {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== "constructor")
    .map((name): [string, Handler] => [name, prototype[name] as Handler])
    .filter(
      ([, handler]) =>
        typeof handler === "function" &&
        Reflect.getMetadata(METHOD_METADATA, handler) !== undefined,
    );
}

function hasMetadata(key: string, target: object): boolean {
  return Reflect.getMetadata(key, target) !== undefined;
}

describe("permission coverage", () => {
  it("guards every route of a controller that uses per-route permissions", async () => {
    const unguarded: string[] = [];
    for (const file of controllerFiles()) {
      const exports = (await import(file)) as Record<string, unknown>;
      for (const value of Object.values(exports)) {
        if (typeof value !== "function") {
          continue;
        }
        const controller = value as Handler;
        const routes = routeHandlers(controller);
        const classGuarded = hasMetadata(PERMISSIONS_KEY, controller);
        const usesPerRoute = routes.some(([, handler]) =>
          hasMetadata(PERMISSIONS_KEY, handler),
        );
        if (classGuarded || !usesPerRoute) {
          continue;
        }
        for (const [name, handler] of routes) {
          if (
            !hasMetadata(PERMISSIONS_KEY, handler) &&
            !hasMetadata(IS_PUBLIC_KEY, handler)
          ) {
            unguarded.push(`${controller.name}.${name}`);
          }
        }
      }
    }
    expect(unguarded).toEqual([]);
  });
});
