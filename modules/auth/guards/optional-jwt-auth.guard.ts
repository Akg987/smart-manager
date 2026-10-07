import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Attaches the user when a valid bearer token is sent; otherwise continues as a guest. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
	handleRequest<TUser>(_err: unknown, user: TUser): TUser | null {
		return user || null;
	}
}
