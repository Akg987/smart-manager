import { Module } from "@nestjs/common";
import { RelationalPermissionPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";
import { PermissionsService } from "./permissions.service";
import { PermissionsManagementController } from "./permissions-management.controller";

@Module({
	imports: [RelationalPermissionPersistenceModule],
	controllers: [PermissionsManagementController],
	providers: [PermissionsService],
	exports: [PermissionsService, RelationalPermissionPersistenceModule],
})
export class PermissionsModule {}
