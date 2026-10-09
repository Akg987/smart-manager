import { Module } from "@nestjs/common";
import { PermissionRepository } from "../permission.repository";
import { PermissionsRelationalRepository } from "./repositories/permission.repository";

@Module({
  providers: [
    {
      provide: PermissionRepository,
      useClass: PermissionsRelationalRepository,
    },
  ],
  exports: [PermissionRepository],
})
export class RelationalPermissionPersistenceModule {}
