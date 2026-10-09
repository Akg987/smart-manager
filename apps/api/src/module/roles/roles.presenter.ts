import { formatTime } from "../../../../../common/utils/time";
import { isLockedRole, type RoleWithPermissions } from "./domain/role";
import type { RoleDto } from "./dto/roles.dto";

export function toRoleDto(row: RoleWithPermissions): RoleDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    locked: isLockedRole(row.key),
    permissions: row.permissions,
    created_at: formatTime(row.createdAt) ?? "",
    updated_at: formatTime(row.updatedAt) ?? "",
    ...(row.description ? { description: row.description } : {}),
  };
}
