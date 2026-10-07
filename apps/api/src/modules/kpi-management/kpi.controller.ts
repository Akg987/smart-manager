import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { KpiManagementService } from "./kpi-management.service.js";
import { CreateKpiDto, SubmitCheckinDto, UpdateKpiDto } from "./kpi.dto.js";
import { currentJalaliPeriod } from "../../shared/jalali.js";

@Controller("kpis") @UseGuards(SessionGuard)
export class KpiController {
	constructor(private readonly service: KpiManagementService) {}
	@Get() dashboard(@Req() req: AuthenticatedRequest) { return this.service.dashboardSnapshot(req.currentUser.id); }
	@Get("options/:group") options(@Param("group") group: "input_mode" | "direction" | "frequency") { return this.service.listStudioOptions(group); }
	@Post() create(@Req() req: AuthenticatedRequest, @Body() body: CreateKpiDto) {
		return this.service.createDefinition({ ...body, actorId: req.currentUser.id, departmentId: BigInt(body.departmentId), ownerUserId: body.ownerUserId == null ? null : BigInt(body.ownerUserId) });
	}
	@Put(":id") update(@Req() req: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Body() body: UpdateKpiDto) {
		return this.service.updateDefinition(BigInt(id), req.currentUser.id, { ...body, ownerUserId: body.ownerUserId == null ? null : BigInt(body.ownerUserId) });
	}
	@Post(":id/checkins") checkin(@Req() req: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Body() body: SubmitCheckinDto) {
		return this.service.submitCheckin({ ...body, period: body.period || currentJalaliPeriod(), kpiId: BigInt(id), userId: req.currentUser.id, actualValue: body.actualValue ?? null });
	}
}
