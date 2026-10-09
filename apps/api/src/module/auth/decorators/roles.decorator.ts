import { SetMetadata } from "@nestjs/common";
import {
  RoleAdmin,
  RoleSeller,
  RoleSuperAdmin,
  RoleWarehouseManager,
} from "../../users/domain/roles";

export const ROLES_KEY = "roles";

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const WAREHOUSE_ADMIN_ROLES = [
  RoleSuperAdmin,
  RoleAdmin,
  RoleWarehouseManager,
];
export const ADMIN_ROLES = [RoleSuperAdmin, RoleAdmin];
export const STAFF_ROLES = [RoleSuperAdmin, RoleAdmin, RoleSeller];
