import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";
import { SettingsRepository } from "./settings.repository.js";

@Module({
  imports: [SessionModule, AuthorizationModule],
  controllers: [SettingsController],
  providers: [SettingsRepository, SettingsService],
})
export class SettingsModule {}
