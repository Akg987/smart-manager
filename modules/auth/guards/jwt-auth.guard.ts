import {
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { AppException } from "../../../common/http/app.exception";
import { OPTIONAL_AUTH_KEY } from "../decorators/optional-auth.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	canActivate(context: ExecutionContext) {
		if (this.isMarked(context, IS_PUBLIC_KEY)) {
			return true;
		}
		return super.canActivate(context);
	}

	handleRequest<TUser>(
		err: unknown,
		user: TUser,
		_info: unknown,
		context: ExecutionContext,
	): TUser {
		if (this.isMarked(context, OPTIONAL_AUTH_KEY)) {
			return (user || null) as TUser;
		}
		if (err instanceof AppException) {
			throw err;
		}
		if (user) {
			return user;
		}
		const request = context.switchToHttp().getRequest<{
			headers: { authorization?: string | string[] };
		}>();
		const raw = request.headers.authorization;
		const header = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
		if (!header.toLowerCase().startsWith("bearer ")) {
			throw AppException.missingAuth();
		}
		if (err instanceof UnauthorizedException) {
			throw AppException.invalidToken();
		}
		throw AppException.invalidToken();
	}

	private isMarked(context: ExecutionContext, key: string): boolean {
		return (
			this.reflector.getAllAndOverride<boolean>(key, [
				context.getHandler(),
				context.getClass(),
			]) === true
		);
	}
}
