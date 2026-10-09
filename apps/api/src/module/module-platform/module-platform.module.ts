import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { ModulePlatformController } from "./module-platform.controller.js";
import { ModulePlatformService } from "./module-platform.service.js";
import { ModulePlatformRepository } from "./module-platform.repository.js";

@Module({
  imports: [SessionModule, AuthorizationModule],
  controllers: [ModulePlatformController],
  providers: [ModulePlatformRepository, ModulePlatformService],
})
export class ModulePlatformModule {}
