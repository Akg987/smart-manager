import { Body, Controller, ForbiddenException, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { OrganizationsService } from "./organizations.service.js";
import { DepartmentDto, UpdateDepartmentDto } from "./organizations.dto.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
@Controller("departments") @UseGuards(SessionGuard)
export class OrganizationsController {
	constructor(private readonly organizations: OrganizationsService, private readonly authorization: AuthorizationService) {}
	@Post() async create(@Req() req: AuthenticatedRequest, @Body() body: DepartmentDto) {
		if (!(await this.authorization.hasPermission(req.currentUser.id, "organization.manage"))) throw new ForbiddenException("Permission denied.");
		return this.organizations.createDepartment({ ...body, managerUserId: body.managerUserId == null ? null : BigInt(body.managerUserId) }, req.currentUser.id);
	}
	@Patch(":id") async update(@Req() req: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Body() body: UpdateDepartmentDto) {
		if (!(await this.authorization.hasPermission(req.currentUser.id, "organization.manage"))) throw new ForbiddenException("Permission denied.");
		return this.organizations.updateDepartment(BigInt(id), { ...body, managerUserId: body.managerUserId == null ? null : BigInt(body.managerUserId) }, req.currentUser.id);
	}
}
