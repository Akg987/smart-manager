import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ApiErrors,
  ApiListEnvelope,
  itemsResult,
  withAdmin,
} from "../../../../../common/http/index";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionDto } from "./dto/permissions.dto";
import { PERMISSION_PERMISSIONS } from "./permissions.permissions";
import { toPermissionDto } from "./permissions.presenter";
import { PermissionsService } from "./permissions.service";

@ApiTags("permissions-management")
@ApiBearerAuth()
@Controller({ path: "permissions-management", version: "1" })
export class PermissionsManagementController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @Permissions(PERMISSION_PERMISSIONS.read)
  @ApiListEnvelope(PermissionDto, { paginated: false })
  @ApiErrors(...withAdmin())
  async list() {
    const rows = await this.permissions.list();
    return itemsResult(rows.map(toPermissionDto));
  }
}
