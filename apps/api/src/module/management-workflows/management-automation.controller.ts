import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import {
  AutomationRunDto,
  CreateEscalationRuleDto,
  ReminderPolicyDto,
  UpdateEscalationRuleDto,
} from "./automation.dto.js";
import { ManagementAutomationService } from "./management-automation.service.js";

@Controller("management-automation")
@UseGuards(SessionGuard)
export class ManagementAutomationController {
  constructor(private readonly service: ManagementAutomationService) {}

  @Get("escalation-rules") listEscalationRules(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listEscalationRules(req.currentUser.id);
  }
  @Post("escalation-rules") createEscalationRule(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateEscalationRuleDto,
  ) {
    return this.service.createEscalationRule(req.currentUser.id, {
      ...body,
      configuration: body.configuration ?? {},
    });
  }
  @Patch("escalation-rules/:id") updateEscalationRule(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateEscalationRuleDto,
  ) {
    return this.service.updateEscalationRule(
      req.currentUser.id,
      BigInt(id),
      body,
    );
  }
  @Get("reminder-policies") listReminderPolicies(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listReminderPolicies(req.currentUser.id);
  }
  @Put("reminder-policies") setReminderPolicy(
    @Req() req: AuthenticatedRequest,
    @Body() body: ReminderPolicyDto,
  ) {
    return this.service.setReminderPolicy(req.currentUser.id, body);
  }
  @Post("run") run(
    @Req() req: AuthenticatedRequest,
    @Body() body: AutomationRunDto,
  ) {
    return this.service.run(req.currentUser.id, body.period);
  }
}
