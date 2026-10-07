import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppException } from "../../../common/http/app.exception";
import {
	type PermissionRef,
	permissionCode,
} from "../../permissions/domain/permission";
import { RoleRepository } from "../../roles/infrastructure/persistence/role.repository";
import type { AuthUser } from "../auth.types";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly roles: RoleRepository,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const required = this.reflector.getAllAndOverride<PermissionRef[]>(
			PERMISSIONS_KEY,
			[context.getHandler(), context.getClass()],
		);
		if (!required?.length) {
			return true;
		}
		const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
		const user = request.user;
		if (!user) {
			throw AppException.unauthorized();
		}
		const granted = await this.roles.listPermissionRefs(user.role);
		const allowed = new Set(granted.map(permissionCode));
		if (
			required.some((permission) => !allowed.has(permissionCode(permission)))
		) {
			throw AppException.forbidden();
		}
		return true;
	}
}
