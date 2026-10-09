import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { AuthorizationService } from "./authorization.service.js";
import { AccessLevelDto, RolePermissionsDto } from "./authorization.dto.js";

@Controller("authorization")
@UseGuards(SessionGuard)
export class AuthorizationController {
  constructor(private readonly authorization: AuthorizationService) {}
  private async requireManageRoles(userId: bigint) {
    if (!(await this.authorization.hasPermission(userId, "manage-roles")))
      throw new ForbiddenException("Permission denied.");
  }
  @Get("access-levels") async list(@Req() req: AuthenticatedRequest) {
    await this.requireManageRoles(req.currentUser.id);
    return this.authorization.listAccessLevels();
  }
  @Post("access-levels") async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: AccessLevelDto,
  ) {
    await this.requireManageRoles(req.currentUser.id);
    return this.authorization.createAccessLevel(
      {
        name: body.name,
        departmentId:
          body.departmentId == null ? null : BigInt(body.departmentId),
        permissions: body.permissions,
      },
      req.currentUser.id,
    );
  }
  @Patch("access-levels/:id") async update(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: AccessLevelDto,
  ) {
    await this.requireManageRoles(req.currentUser.id);
    return this.authorization.updateAccessLevel(
      BigInt(id),
      {
        name: body.name,
        departmentId:
          body.departmentId == null ? null : BigInt(body.departmentId),
        permissions: body.permissions,
      },
      req.currentUser.id,
    );
  }
  @Delete("access-levels/:id") async remove(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    await this.requireManageRoles(req.currentUser.id);
    return this.authorization.deleteAccessLevel(BigInt(id), req.currentUser.id);
  }
  @Get("roles") async rolePermissions(@Req() req: AuthenticatedRequest) {
    await this.requireManageRoles(req.currentUser.id);
    return this.authorization.getRolePermissions();
  }
  @Put("roles/:role") async updateRole(
    @Req() req: AuthenticatedRequest,
    @Param("role") role: string,
    @Body() body: RolePermissionsDto,
  ) {
    await this.requireManageRoles(req.currentUser.id);
    if (role !== "admin" && role !== "user")
      throw new ForbiddenException("Unknown role.");
    return {
      role,
      permissions: await this.authorization.syncRolePermissions(
        role,
        body.permissions,
        req.currentUser.id,
      ),
    };
  }
}
