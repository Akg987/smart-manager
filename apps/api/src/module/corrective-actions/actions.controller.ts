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
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { CorrectiveActionsService } from "./corrective-actions.service.js";
import {
  ActionPriorityDto,
  ActionAssignmentDto,
  ActionProgressDto,
  ActionStatusDto,
  CreateActionDto,
} from "./actions.dto.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { FastifyFileInterceptor } from "../../common/interceptors/fastify-file.interceptor.js";
import { UploadedFastifyFile } from "../../common/decorators/uploaded-fastify-file.decorator.js";
import { SkipResponseWrap } from "../../common/decorators/skip-response-wrap.decorator.js";

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
  @Get("create-form") createForm(@Req() req: AuthenticatedRequest) {
    return this.service.createForm(req.currentUser.id);
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
      departmentId:
        body.departmentId == null ? undefined : BigInt(body.departmentId),
      businessUnitId: BigInt(body.businessUnitId),
      alertId: body.alertId == null ? null : BigInt(body.alertId),
      sourceId: body.sourceId == null ? null : BigInt(body.sourceId),
      sourceType: body.sourceType ?? null,
      baseline: body.baseline ?? null,
      target: body.target ?? null,
      ownerUserId: BigInt(body.ownerUserId),
      approverUserId: BigInt(body.approverUserId),
      createdBy: req.currentUser.id,
    });
  }
  @Patch(":id/assignment") updateAssignment(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ActionAssignmentDto,
  ) {
    return this.service.updateAssignment(BigInt(id), {
      ownerUserId: BigInt(body.ownerUserId),
      dueAt: body.dueAt,
      actorId: req.currentUser.id,
      reason: body.reason,
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
      body.reason,
    );
  }

  @Patch(":id/progress") updateProgress(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ActionProgressDto,
  ) {
    return this.service.updateProgress(
      BigInt(id),
      body.progress,
      req.currentUser.id,
      body.reason,
    );
  }

  @Post(":id/evidence")
  @UseInterceptors(FastifyFileInterceptor("evidence"))
  uploadEvidence(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @UploadedFastifyFile() file:
      | { buffer: Buffer; filename: string; mimetype: string }
      | undefined,
  ) {
    return this.service.uploadEvidence(BigInt(id), req.currentUser.id, file);
  }

  @Get(":id/evidence/:evidenceId")
  @SkipResponseWrap()
  async readEvidence(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Param("evidenceId", ParseIntPipe) evidenceId: number,
    @Res() reply: FastifyReply,
  ) {
    const { evidence, buffer } = await this.service.readEvidence(
      BigInt(id),
      BigInt(evidenceId),
      req.currentUser.id,
    );
    return reply
      .header("Cache-Control", "private, no-store")
      .header(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(evidence.originalFileName)}`,
      )
      .type(evidence.mimeType)
      .send(buffer);
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
