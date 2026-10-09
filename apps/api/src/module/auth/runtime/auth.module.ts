import { Module } from "@nestjs/common";
import { SessionModule } from "../../../common/session.module.js";
import { SmsIppanelHubModule } from "../../sms-ippanel-hub/sms-ippanel-hub.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AuthRepository } from "./auth.repository.js";

@Module({
  imports: [SessionModule, SmsIppanelHubModule],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService],
  exports: [AuthService],
})
export class AuthModule {}
