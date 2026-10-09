import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { CheckinsController } from "./checkins.controller.js";
import { KpiController } from "./kpi.controller.js";
import { KpiManagementRepository } from "./kpi-management.repository.js";
import { KpiManagementService } from "./kpi-management.service.js";
import { DerivedKpiController } from "./derived-kpi.controller.js";
import { DerivedKpiRepository } from "./derived-kpi.repository.js";
import { DerivedKpiService } from "./derived-kpi.service.js";

@Module({
  imports: [SessionModule, AuthorizationModule],
  controllers: [KpiController, CheckinsController, DerivedKpiController],
  providers: [
    KpiManagementRepository,
    KpiManagementService,
    DerivedKpiRepository,
    DerivedKpiService,
  ],
  exports: [KpiManagementService],
})
export class KpiManagementModule {}
