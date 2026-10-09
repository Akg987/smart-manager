import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { CorrectiveActionsModule } from "../corrective-actions/corrective-actions.module.js";
import { KpiManagementModule } from "../kpi-management/kpi-management.module.js";
import { DecisionsModule } from "../decisions/decisions.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";
import { DashboardRepository } from "./dashboard.repository.js";
import { DashboardPlatformRepository } from "./dashboard-platform.repository.js";
import { DashboardPlatformService } from "./dashboard-platform.service.js";

@Module({
  imports: [
    SessionModule,
    AuthorizationModule,
    KpiManagementModule,
    CorrectiveActionsModule,
    DecisionsModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardRepository,
    DashboardService,
    DashboardPlatformRepository,
    DashboardPlatformService,
  ],
})
export class DashboardModule {}
