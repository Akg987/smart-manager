import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { DashboardService } from "./dashboard.service.js";
import { KpiManagementService } from "../kpi-management/kpi-management.service.js";
import { CorrectiveActionsService } from "../corrective-actions/corrective-actions.service.js";

@Controller("dashboard")
@UseGuards(SessionGuard)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly kpis: KpiManagementService,
    private readonly actions: CorrectiveActionsService,
  ) {}
  @Get() async snapshot(@Req() req: AuthenticatedRequest) {
    return { dashboard: await this.dashboard.snapshot(req.currentUser.id) };
  }
  @Get("kpis") async kpisSnapshot(@Req() req: AuthenticatedRequest) {
    return { dashboard: await this.kpis.dashboardSnapshot(req.currentUser.id) };
  }
  @Get("actions") async actionsSnapshot(@Req() req: AuthenticatedRequest) {
    return {
      dashboard: await this.actions.dashboardSnapshot(req.currentUser.id),
    };
  }
}
