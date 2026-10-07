import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { SmsIppanelHubService } from "./sms-ippanel-hub.service.js";
import { UpdateSmsSettingsDto } from "./sms.dto.js";

@Controller("sms")
@UseGuards(SessionGuard)
export class SmsController {
  constructor(
    private readonly sms: SmsIppanelHubService,
    private readonly authorization: AuthorizationService,
  ) {}
  @Get("settings") async status(@Req() req: AuthenticatedRequest) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "sms.view-settings",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return { configured: await this.sms.configured() };
  }
  @Patch("settings") async update(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateSmsSettingsDto,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "sms.manage-settings",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.sms.saveSettings(body.apiKey ?? "", body.sender);
  }
}
