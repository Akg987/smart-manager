import { Injectable } from "@nestjs/common";
import { AppException } from "../../../../../common/http/app.exception";
import {
  PERMISSION_PART_PATTERN,
  type PermissionRef,
  permissionCode,
} from "../permissions/domain/permission";
import { PermissionsService } from "../permissions/permissions.service";
import {
  isSystemRole,
  ROLE_KEY_PATTERN,
  type Role,
  type RoleWithPermissions,
  type WriteRoleInput,
} from "./domain/role";
import { RoleRepository } from "./infrastructure/persistence/role.repository";

@Injectable()
export class RolesService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly permissions: PermissionsService,
  ) {}

  list(): Promise<RoleWithPermissions[]> {
    return this.roles.listWithPermissions();
  }

  async getByKey(roleKey: string): Promise<RoleWithPermissions> {
    const role = await this.requireRole(roleKey);
    const permissions = await this.roles.listGrants(role.id);
    return { ...role, permissions };
  }

  permissionRefsFor(roleKey: string): Promise<PermissionRef[]> {
    return this.roles.listPermissionRefs(roleKey);
  }

  async create(
    input: WriteRoleInput & { permissions?: readonly PermissionRef[] },
  ): Promise<RoleWithPermissions> {
    assertRoleKey(input.key);
    const name = requireName(input.name);
    const existing = await this.roles.findByKey(input.key);
    if (existing) {
      throw AppException.invalidInput("duplicate role");
    }
    const permissionIds = await this.resolvePermissionIds(
      input.permissions ?? [],
    );
    const role = await this.roles.upsert({
      key: input.key,
      name,
      description: input.description,
    });
    if (input.permissions) {
      await this.roles.replaceEditablePermissions(role.id, permissionIds);
    }
    return this.getByKey(role.key);
  }

  async update(
    roleKey: string,
    input: { name: string; description?: string | null },
  ): Promise<RoleWithPermissions> {
    const current = await this.requireRole(roleKey);
    const name = requireName(input.name);
    const role = await this.roles.upsert({
      key: current.key,
      name,
      description:
        input.description === undefined
          ? current.description
          : input.description,
    });
    return this.getByKey(role.key);
  }

  async upsert(input: WriteRoleInput): Promise<Role> {
    assertRoleKey(input.key);
    const name = requireName(input.name);
    return this.roles.upsert({
      key: input.key,
      name,
      description: input.description,
    });
  }

  async grantMissing(
    roleKey: string,
    permissionRefs: readonly PermissionRef[],
  ): Promise<void> {
    const role = await this.requireRole(roleKey);
    const permissionIds = await this.resolvePermissionIds(permissionRefs);
    if (permissionIds.length === 0) {
      return;
    }
    await this.roles.grantMissing(role.id, permissionIds);
  }

  async syncLocked(
    roleKey: string,
    permissionRefs: readonly PermissionRef[],
  ): Promise<void> {
    const role = await this.requireRole(roleKey);
    const permissionIds = await this.resolvePermissionIds(permissionRefs);
    await this.roles.syncLockedGrants(role.id, permissionIds);
  }

  async setPermissions(
    roleKey: string,
    permissionRefs: readonly PermissionRef[],
  ): Promise<RoleWithPermissions> {
    const role = await this.requireRole(roleKey);
    const desired = await this.resolvePermissions(permissionRefs);
    const grants = await this.roles.listGrants(role.id);
    const lockedCodes = new Set(
      grants.filter((grant) => grant.locked).map(permissionCode),
    );
    for (const code of lockedCodes) {
      if (!desired.some((permission) => permissionCode(permission) === code)) {
        throw AppException.invalidInput("system permission cannot be removed");
      }
    }
    const editableIds = desired
      .filter((permission) => !lockedCodes.has(permissionCode(permission)))
      .map((permission) => permission.id);
    await this.roles.replaceEditablePermissions(role.id, editableIds);
    return this.getByKey(role.key);
  }

  async remove(roleKey: string): Promise<void> {
    assertRoleKey(roleKey);
    if (isSystemRole(roleKey)) {
      throw AppException.conflict("system role cannot be deleted");
    }
    const deleted = await this.roles.deleteByKey(roleKey);
    if (!deleted) {
      throw AppException.notFound("role not found");
    }
  }

  private async requireRole(roleKey: string): Promise<Role> {
    assertRoleKey(roleKey);
    const role = await this.roles.findByKey(roleKey);
    if (!role) {
      throw AppException.notFound("role not found");
    }
    return role;
  }

  private async resolvePermissionIds(
    permissionRefs: readonly PermissionRef[],
  ): Promise<number[]> {
    const found = await this.resolvePermissions(permissionRefs);
    return found.map((permission) => permission.id);
  }

  private async resolvePermissions(permissionRefs: readonly PermissionRef[]) {
    const uniqueRefs = uniquePermissionRefs(permissionRefs);
    if (uniqueRefs.length === 0) {
      return [];
    }
    for (const ref of uniqueRefs) {
      if (
        !PERMISSION_PART_PATTERN.test(ref.module) ||
        !PERMISSION_PART_PATTERN.test(ref.action)
      ) {
        throw AppException.invalidInput("invalid permission");
      }
    }
    const found = await this.permissions.findByRefs(uniqueRefs);
    if (found.length !== uniqueRefs.length) {
      throw AppException.invalidInput("unknown permission");
    }
    return found;
  }
}

function uniquePermissionRefs(refs: readonly PermissionRef[]): PermissionRef[] {
  const seen = new Set<string>();
  const unique: PermissionRef[] = [];
  for (const ref of refs) {
    const code = permissionCode(ref);
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);
    unique.push(ref);
  }
  return unique;
}

function assertRoleKey(key: string): void {
  if (!ROLE_KEY_PATTERN.test(key)) {
    throw AppException.invalidInput("invalid role key");
  }
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw AppException.invalidInput("role name is required");
  }
  return trimmed;
}
