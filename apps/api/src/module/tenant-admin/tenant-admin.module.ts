import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { TenantAdminController } from "./tenant-admin.controller.js";
import { TenantAdminRepository } from "./tenant-admin.repository.js";
import { TenantAdminService } from "./tenant-admin.service.js";

@Module({
  imports: [SessionModule, AuthorizationModule],
  controllers: [TenantAdminController],
  providers: [TenantAdminRepository, TenantAdminService],
})
export class TenantAdminModule {}
