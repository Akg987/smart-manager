import {
  Body,
  Controller,
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
import { CreateDecisionDto, DecisionOutcomeDto } from "./decisions.dto.js";
import { DecisionsService } from "./decisions.service.js";

@Controller("decisions")
@UseGuards(SessionGuard)
export class DecisionsController {
  constructor(private readonly service: DecisionsService) {}

  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.currentUser.id);
  }

  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateDecisionDto,
  ) {
    return this.service.create(req.currentUser.id, {
      ...body,
      businessUnitId:
        body.businessUnitId == null ? undefined : BigInt(body.businessUnitId),
      ownerUserId:
        body.ownerUserId == null ? body.ownerUserId : BigInt(body.ownerUserId),
      relatedKpiIds: body.relatedKpiIds?.map(BigInt),
      actionIds: body.actionIds?.map(BigInt),
    });
  }

  @Post(":id/approve") approve(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.approve(req.currentUser.id, BigInt(id));
  }

  @Patch(":id/status") updateOutcome(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: DecisionOutcomeDto,
  ) {
    return this.service.updateOutcome(req.currentUser.id, BigInt(id), body);
  }
}
