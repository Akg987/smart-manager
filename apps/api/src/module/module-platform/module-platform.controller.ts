import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean } from "class-validator";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { ModulePlatformService } from "./module-platform.service.js";
class ActivationDto {
  @IsBoolean() active!: boolean;
}
@Controller("modules")
@UseGuards(SessionGuard)
export class ModulePlatformController {
  constructor(
    private readonly modules: ModulePlatformService,
    private readonly authorization: AuthorizationService,
  ) {}
  @Delete(":slug") async remove(
    @Req() req: AuthenticatedRequest,
    @Param("slug") slug: string,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "manage-modules",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.modules.remove(slug, req.currentUser.id);
  }
  @Patch(":slug/activation") async activate(
    @Req() req: AuthenticatedRequest,
    @Param("slug") slug: string,
    @Body() body: ActivationDto,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "manage-modules",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.modules.setActive(slug, body.active, req.currentUser.id);
  }
}
