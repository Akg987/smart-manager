import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { DashboardService } from "./dashboard.service.js";
import { KpiManagementService } from "../kpi-management/kpi-management.service.js";
import { CorrectiveActionsService } from "../corrective-actions/corrective-actions.service.js";
import { DashboardPlatformService } from "./dashboard-platform.service.js";
import {
  CreateDashboardDto,
  DuplicateDashboardDto,
  UpdateDashboardDto,
} from "./dashboard-platform.dto.js";

@Controller("dashboard")
@UseGuards(SessionGuard)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly kpis: KpiManagementService,
    private readonly actions: CorrectiveActionsService,
    private readonly boards: DashboardPlatformService,
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

  @Get("boards") listBoards(@Req() req: AuthenticatedRequest) {
    return this.boards.list(req.currentUser.id);
  }
  @Get("boards/templates") boardTemplates(@Req() req: AuthenticatedRequest) {
    return this.boards.templates(req.currentUser.id);
  }
  @Post("boards") createBoard(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateDashboardDto,
  ) {
    return this.boards.create(req.currentUser.id, body);
  }
  @Get("boards/:id/history") boardHistory(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.boards.history(req.currentUser.id, BigInt(id));
  }
  @Get("boards/:id") board(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Query("mode") mode?: string,
  ) {
    return this.boards.view(
      req.currentUser.id,
      BigInt(id),
      mode === "edit" || mode === "preview" ? mode : "view",
    );
  }
  @Put("boards/:id") updateBoard(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateDashboardDto,
  ) {
    return this.boards.update(req.currentUser.id, BigInt(id), body);
  }
  @Post("boards/:id/duplicate") duplicateBoard(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: DuplicateDashboardDto,
  ) {
    return this.boards.duplicate(req.currentUser.id, BigInt(id), body.name);
  }
  @Post("boards/:id/publish") publishBoard(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.boards.publish(req.currentUser.id, BigInt(id));
  }
  @Delete("boards/:id") archiveBoard(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.boards.archive(req.currentUser.id, BigInt(id));
  }
}
