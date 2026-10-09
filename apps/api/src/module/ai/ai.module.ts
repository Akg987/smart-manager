import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { CorrectiveActionsModule } from "../corrective-actions/corrective-actions.module.js";
import { DashboardModule } from "../dashboard/dashboard.module.js";
import { DecisionsModule } from "../decisions/decisions.module.js";
import { KpiManagementModule } from "../kpi-management/kpi-management.module.js";
import { AiController } from "./ai.controller.js";
import { AiRepository } from "./ai.repository.js";
import { AiService } from "./ai.service.js";

@Module({
  imports: [
    SessionModule,
    AuthorizationModule,
    KpiManagementModule,
    CorrectiveActionsModule,
    DecisionsModule,
    DashboardModule,
  ],
  controllers: [AiController],
  providers: [AiRepository, AiService],
})
export class AiModule {}
