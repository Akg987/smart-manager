import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { CorrectiveActionsService } from "./corrective-actions.service.js";
import { ActionPriorityDto, ActionStatusDto, CreateActionDto } from "./actions.dto.js";
import { AuthorizationService } from "../authorization/authorization.service.js";

@Controller("actions") @UseGuards(SessionGuard)
export class ActionsController {
	constructor(private readonly service: CorrectiveActionsService, private readonly authorization: AuthorizationService) {}
	@Get() dashboard(@Req() req: AuthenticatedRequest) { return this.service.dashboardSnapshot(req.currentUser.id); }
	@Get("priorities") priorities() { return this.service.listPriorities(); }
	@Post("priorities") async addPriority(@Req() req: AuthenticatedRequest, @Body() body: ActionPriorityDto) {
		if (!(await this.authorization.hasPermission(req.currentUser.id, "actions.manage"))) throw new ForbiddenException("Permission denied.");
		return this.service.addPriority(body.name);
	}
	@Patch("priorities/:id") async renamePriority(@Req() req: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Body() body: ActionPriorityDto) {
		if (!(await this.authorization.hasPermission(req.currentUser.id, "actions.manage"))) throw new ForbiddenException("Permission denied.");
		return this.service.renamePriority(BigInt(id), body.name);
	}
	@Post() create(@Req() req: AuthenticatedRequest, @Body() body: CreateActionDto) { return this.service.create({ ...body, departmentId: BigInt(body.departmentId), alertId: body.alertId == null ? null : BigInt(body.alertId), ownerUserId: BigInt(body.ownerUserId), createdBy: req.currentUser.id }); }
	@Patch(":id/status") updateStatus(@Req() req: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Body() body: ActionStatusDto) { return this.service.updateStatus(BigInt(id), body.status, req.currentUser.id); }
}
