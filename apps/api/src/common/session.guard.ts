import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { SessionService, type AuthenticatedRequest } from "./session.service.js";

@Injectable()
export class SessionGuard implements CanActivate {
	constructor(private readonly sessions: SessionService) {}
	async canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		request.currentUser = await this.sessions.user(request);
		return true;
	}
}
