import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { RelationalRolePersistenceModule } from "../roles/infrastructure/persistence/relational/relational-persistence.module";
import { SessionModule } from "../session/session.module";
import { SmsModule } from "../sms/sms.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthJwtService } from "./auth-jwt.service";
import { AuthValidationService } from "./auth-validation.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
	imports: [
		UsersModule,
		RelationalRolePersistenceModule,
		SessionModule,
		SmsModule,
		PassportModule.register({ defaultStrategy: "jwt" }),
		JwtModule.register({}),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		AuthJwtService,
		AuthValidationService,
		JwtStrategy,
		JwtAuthGuard,
		PermissionsGuard,
		RolesGuard,
	],
	exports: [
		AuthService,
		AuthJwtService,
		AuthValidationService,
		JwtAuthGuard,
		PermissionsGuard,
		RolesGuard,
		PassportModule,
	],
})
export class AuthModule {}
