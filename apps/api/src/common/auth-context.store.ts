import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import type { SmartManagerAuthContext } from "../module/permissions/smart-manager-authorization.js";

@Injectable()
export class AuthContextStore {
  private readonly storage = new AsyncLocalStorage<SmartManagerAuthContext>();

  current(userId?: string) {
    const context = this.storage.getStore();
    return context && (!userId || context.userId === userId) ? context : null;
  }

  run<T>(context: SmartManagerAuthContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }
}
