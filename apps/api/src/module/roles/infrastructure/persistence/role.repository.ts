import type { PermissionRef } from "../../../permissions/domain/permission";
import type {
  Role,
  RolePermissionGrant,
  RoleWithPermissions,
  WriteRoleInput,
} from "../../domain/role";

export abstract class RoleRepository {
  abstract list(): Promise<Role[]>;
  abstract listWithPermissions(): Promise<RoleWithPermissions[]>;
  abstract findByKey(key: string): Promise<Role | null>;
  abstract upsert(input: WriteRoleInput): Promise<Role>;
  abstract deleteByKey(key: string): Promise<boolean>;
  abstract listPermissionRefs(roleKey: string): Promise<PermissionRef[]>;
  abstract listGrants(roleId: number): Promise<RolePermissionGrant[]>;
  abstract grantMissing(roleId: number, permissionIds: number[]): Promise<void>;
  abstract syncLockedGrants(
    roleId: number,
    permissionIds: number[],
  ): Promise<void>;
  abstract replaceEditablePermissions(
    roleId: number,
    permissionIds: number[],
  ): Promise<void>;
}
