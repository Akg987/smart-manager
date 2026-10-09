import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import type { AppRequest } from "../http.js";
import { AuthContextStore } from "../auth-context.store.js";

@Injectable()
export class AuthContextInterceptor implements NestInterceptor {
  constructor(private readonly contexts: AuthContextStore) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const authContext = request.authContext;
    if (!authContext) return next.handle();
    return new Observable((subscriber) =>
      this.contexts.run(authContext, () => next.handle().subscribe(subscriber)),
    );
  }
}
