import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { SettingsService } from "./settings.service.js";
class BrandingDto { @IsString() @MaxLength(150) companyName!: string; @IsOptional() @IsString() logoPath?: string | null; }
@Controller("settings") @UseGuards(SessionGuard)
export class SettingsController {
	constructor(private readonly settings: SettingsService, private readonly authorization: AuthorizationService) {}
	@Get("branding") branding() { return this.settings.getBranding(); }
	@Patch("branding") async update(@Req() req: AuthenticatedRequest, @Body() body: BrandingDto) {
		if (!(await this.authorization.hasPermission(req.currentUser.id, "settings.manage"))) throw new ForbiddenException("Permission denied.");
		return this.settings.updateBranding(body.companyName, body.logoPath ?? null);
	}
}
