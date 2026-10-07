import { Body, Controller, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { CorrectiveActionsService } from "./corrective-actions.service.js";
import { ResolveAlertDto } from "./actions.dto.js";
@Controller("alerts") @UseGuards(SessionGuard)
export class AlertsController {
	constructor(private readonly service: CorrectiveActionsService) {}
	@Post(":id/acknowledge") acknowledge(@Req() req: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number) { return this.service.acknowledgeAlert(BigInt(id), req.currentUser.id); }
	@Post(":id/resolve") resolve(@Req() req: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Body() body: ResolveAlertDto) { return this.service.resolveAlert(BigInt(id), req.currentUser.id, body.note ?? ""); }
}
