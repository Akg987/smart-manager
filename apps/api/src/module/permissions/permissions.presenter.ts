import { formatTime } from "../../../../../common/utils/time";
import type { Permission } from "./domain/permission";
import type { PermissionDto } from "./dto/permissions.dto";

export function toPermissionDto(row: Permission): PermissionDto {
  return {
    id: row.id,
    module: row.module,
    action: row.action,
    created_at: formatTime(row.createdAt) ?? "",
    updated_at: formatTime(row.updatedAt) ?? "",
    ...(row.description ? { description: row.description } : {}),
  };
}
