import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { KpiManagementService } from "./kpi-management.service.js";
import { SubmitCheckinDto } from "./kpi.dto.js";
import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

class CreateCheckinDto extends SubmitCheckinDto {
	@Type(() => Number) @IsNumber() @Min(1) kpiId!: number;
}

@Controller("checkins") @UseGuards(SessionGuard)
export class CheckinsController {
	constructor(private readonly kpis: KpiManagementService) {}
	@Post() create(@Req() req: AuthenticatedRequest, @Body() body: CreateCheckinDto) {
		return this.kpis.submitCheckin({ ...body, kpiId: BigInt(body.kpiId), userId: req.currentUser.id, actualValue: body.actualValue ?? null });
	}
}
