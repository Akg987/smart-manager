import { Module } from "@nestjs/common";
import { RoleRepository } from "../role.repository";
import { RolesRelationalRepository } from "./repositories/role.repository";

@Module({
	providers: [
		{
			provide: RoleRepository,
			useClass: RolesRelationalRepository,
		},
	],
	exports: [RoleRepository],
})
export class RelationalRolePersistenceModule {}
