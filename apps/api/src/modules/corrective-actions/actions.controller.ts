import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { CorrectiveActionsService } from "./corrective-actions.service.js";
import {
  ActionPriorityDto,
  ActionStatusDto,
  CreateActionDto,
} from "./actions.dto.js";
import { AuthorizationService } from "../authorization/authorization.service.js";

@Controller("actions")
@UseGuards(SessionGuard)
export class ActionsController {
  constructor(
    private readonly service: CorrectiveActionsService,
    private readonly authorization: AuthorizationService,
  ) {}
  @Get() dashboard(@Req() req: AuthenticatedRequest) {
    return this.service.dashboardSnapshot(req.currentUser.id);
  }
  @Get("board") board(@Req() req: AuthenticatedRequest) {
    return this.service.actionBoard(req.currentUser.id);
  }
  @Get("weekly") weekly(@Req() req: AuthenticatedRequest) {
    const { from, to } = tehranWeek();
    return this.service.weeklySnapshot(req.currentUser.id, from, to);
  }
  @Get("priorities") priorities() {
    return this.service.listPriorities();
  }
  @Post("priorities") async addPriority(
    @Req() req: AuthenticatedRequest,
    @Body() body: ActionPriorityDto,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "actions.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.service.addPriority(body.name);
  }
  @Delete("priorities/:id") async deletePriority(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "actions.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.service.deletePriority(BigInt(id));
  }
  @Patch("priorities/:id") async renamePriority(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ActionPriorityDto,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "actions.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.service.renamePriority(BigInt(id), body.name);
  }
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateActionDto,
  ) {
    return this.service.create({
      ...body,
      departmentId: BigInt(body.departmentId),
      alertId: body.alertId == null ? null : BigInt(body.alertId),
      ownerUserId: BigInt(body.ownerUserId),
      createdBy: req.currentUser.id,
    });
  }
  @Patch(":id/status") updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ActionStatusDto,
  ) {
    return this.service.updateStatus(
      BigInt(id),
      body.status,
      req.currentUser.id,
    );
  }
}

function tehranWeek(now = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    weekday: "short",
  }).format(now);
  const sinceSaturday =
    { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 }[weekday] ?? 0;
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  start.setUTCDate(start.getUTCDate() - sinceSaturday);
  const from = new Date(start.getTime() - (3 * 60 + 30) * 60 * 1000);
  return { from, to: new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000 - 1) };
}
