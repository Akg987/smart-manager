import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { ActionsController } from "./actions.controller.js";
import { AlertsController } from "./alerts.controller.js";
import { CorrectiveActionsRepository } from "./corrective-actions.repository.js";
import { CorrectiveActionsService } from "./corrective-actions.service.js";

@Module({
  imports: [SessionModule, AuthorizationModule],
  controllers: [ActionsController, AlertsController],
  providers: [CorrectiveActionsRepository, CorrectiveActionsService],
  exports: [CorrectiveActionsService],
})
export class CorrectiveActionsModule {}
