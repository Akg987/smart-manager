import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppException } from "../../../common/http/app.exception";
import type { AuthUser } from "../auth.types";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<string[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);
		if (!requiredRoles?.length) {
			return true;
		}
		const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
		const user = request.user;
		if (!user) {
			throw AppException.unauthorized();
		}
		if (!requiredRoles.includes(user.role)) {
			throw AppException.forbidden();
		}
		return true;
	}
}
