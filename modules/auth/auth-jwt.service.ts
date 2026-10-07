import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { EnvironmentVariables } from "../../core/config/env.validation";
import type { JwtPayload, TokenPair } from "./auth.types";

@Injectable()
export class AuthJwtService {
	constructor(
		private readonly jwtService: JwtService,
		private readonly config: ConfigService<EnvironmentVariables, true>,
	) {}

	async generatePair(userId: number, phone: string): Promise<TokenPair> {
		const payload: JwtPayload = { user_id: userId, phone };
		const [access_token, refresh_token] = await Promise.all([
			this.jwtService.signAsync(payload, {
				secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
				expiresIn: `${this.config.get("JWT_ACCESS_TTL_MINUTES", { infer: true })}m`,
				jwtid: randomUUID(),
			}),
			this.jwtService.signAsync(payload, {
				secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }),
				expiresIn: `${this.config.get("JWT_REFRESH_TTL_DAYS", { infer: true })}d`,
				jwtid: randomUUID(),
			}),
		]);
		return { access_token, refresh_token };
	}

	async parseRefresh(token: string): Promise<JwtPayload> {
		return this.jwtService.verifyAsync<JwtPayload>(token, {
			secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }),
		});
	}
}
