import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { SmsController } from "./sms.controller.js";
import { SmsIppanelHubService } from "./sms-ippanel-hub.service.js";
import { SmsIppanelHubRepository } from "./sms-ippanel-hub.repository.js";

@Module({
  imports: [SessionModule, AuthorizationModule],
  controllers: [SmsController],
  providers: [SmsIppanelHubRepository, SmsIppanelHubService],
  exports: [SmsIppanelHubService],
})
export class SmsIppanelHubModule {}
