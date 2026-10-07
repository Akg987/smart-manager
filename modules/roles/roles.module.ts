import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { RelationalRolePersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";
import { RolesService } from "./roles.service";
import { RolesManagementController } from "./roles-management.controller";

@Module({
	imports: [RelationalRolePersistenceModule, PermissionsModule],
	controllers: [RolesManagementController],
	providers: [RolesService],
	exports: [RolesService, RelationalRolePersistenceModule],
})
export class RolesModule {}
