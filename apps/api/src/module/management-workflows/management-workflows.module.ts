import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { CorrectiveActionsModule } from "../corrective-actions/corrective-actions.module.js";
import { DecisionsModule } from "../decisions/decisions.module.js";
import { KpiManagementModule } from "../kpi-management/kpi-management.module.js";
import { ManagementReviewController } from "./management-review.controller.js";
import { ManagementReviewRepository } from "./management-review.repository.js";
import { ManagementReviewService } from "./management-review.service.js";
import { ManagementAutomationController } from "./management-automation.controller.js";
import { ManagementAutomationRepository } from "./management-automation.repository.js";
import { ManagementAutomationService } from "./management-automation.service.js";

@Module({
  imports: [
    SessionModule,
    AuthorizationModule,
    KpiManagementModule,
    CorrectiveActionsModule,
    DecisionsModule,
  ],
  controllers: [ManagementReviewController, ManagementAutomationController],
  providers: [
    ManagementReviewRepository,
    ManagementReviewService,
    ManagementAutomationRepository,
    ManagementAutomationService,
  ],
})
export class ManagementWorkflowsModule {}
