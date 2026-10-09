import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SMART_MANAGER_PERMISSION_KEYS } from "../permissions/smart-manager-catalog.js";
import {
  canWithGrants,
  type SmartManagerAuthContext,
  type SmartManagerGrant,
  type SmartManagerResourceContext,
} from "../permissions/smart-manager-authorization.js";
import { AuthorizationRepository } from "./authorization.repository.js";
import { AuthContextStore } from "../../common/auth-context.store.js";

const legacyPermissions = [
  "manage-modules",
  "manage-settings",
  "manage-users",
  "manage-roles",
  "view-audit-log",
  "manage-departments",
  "access-all-departments",
  "alerts.view",
  "alerts.acknowledge",
  "alerts.resolve",
  "actions.view",
  "actions.manage",
  "actions.update-own",
  "kpi.view",
  "kpi.manage",
  "kpi.submit",
] as const;

export const knownPermissions = [
  ...legacyPermissions,
  ...SMART_MANAGER_PERMISSION_KEYS,
] as const;

export const permissionGroups = [
  {
    group: "سیستم",
    permissions: [
      "manage-modules",
      "manage-settings",
      "manage-users",
      "manage-roles",
      "view-audit-log",
    ],
  },
  {
    group: "سازمان",
    permissions: ["manage-departments", "access-all-departments"],
  },
  { group: "شاخص‌ها", permissions: ["kpi.view", "kpi.manage", "kpi.submit"] },
  {
    group: "اقدام اصلاحی",
    permissions: [
      "alerts.view",
      "alerts.acknowledge",
      "alerts.resolve",
      "actions.view",
      "actions.manage",
      "actions.update-own",
    ],
  },
] as const;

const permissionAliases: Record<string, string> = {
  "settings.manage": "integration.manage",
  "organization.manage": "company.manage",
  "organization.view": "company.view",
  "users.view": "users.view",
  "users.approve": "users.manage",
  "users.assign-organization": "users.manage",
  "access-levels.view": "roles.view",
  "audit.view": "audit.view",
  "modules.view": "integration.view",
  "modules.manage": "integration.manage",
  "kpis.view": "kpi.view",
  "sms.view-settings": "integration.view",
  "sms.manage-settings": "integration.manage",
  "manage-users": "users.manage",
  "manage-roles": "roles.manage",
  "manage-modules": "integration.manage",
  "manage-settings": "integration.manage",
  "view-audit-log": "audit.view",
  "manage-departments": "company.manage",
  "access-all-departments": "company.view",
};

const tenantPermissionAliases: Record<string, string> = {
  "alerts.view": "alert.view",
  "alerts.acknowledge": "alert.acknowledge",
  "alerts.resolve": "alert.resolve",
  "actions.view": "action.view",
  "actions.manage": "action.manage",
  "actions.update-own": "action.update-own",
  "kpi.manage": "kpi.manage",
};

export function canonicalTenantPermission(permission: string): string {
  const legacyCanonical = canonicalPermission(permission);
  return tenantPermissionAliases[legacyCanonical] ?? legacyCanonical;
}

export function canonicalPermission(permission: string): string {
  const normalized = permission.trim().toLowerCase();
  return permissionAliases[normalized] ?? normalized;
}

const jsonSafe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly repository: AuthorizationRepository,
    private readonly contexts: AuthContextStore,
  ) {}

  async can(
    authContext: SmartManagerAuthContext | null | undefined,
    permission: string,
    resourceContext: SmartManagerResourceContext,
  ): Promise<boolean> {
    if (!authContext) return false;
    const canonical = canonicalTenantPermission(permission);
    if (
      !(SMART_MANAGER_PERMISSION_KEYS as readonly string[]).includes(canonical)
    )
      return false;
    const grants = await this.repository.permissionGrants(
      authContext as SmartManagerAuthContext,
      canonical,
    );
    return canWithGrants(authContext, canonical, resourceContext, grants);
  }

  async listAccessLevels() {
    const { rows, grants } = await this.repository.listAccessLevels();
    return jsonSafe(
      rows.map(({ level, departmentName }) => ({
        ...level,
        departmentName,
        permissions: grants
          .filter((grant) => grant.accessLevelId === level.id)
          .map((grant) => grant.permission),
      })),
    );
  }

  createAccessLevel(
    input: {
      name: string;
      departmentId: bigint | null;
      permissions?: string[];
    },
    actorId: bigint,
  ) {
    return this.saveAccessLevel(input, actorId);
  }

  updateAccessLevel(
    id: bigint,
    input: {
      name: string;
      departmentId: bigint | null;
      permissions?: string[];
    },
    actorId: bigint,
  ) {
    return this.saveAccessLevel(input, actorId, id);
  }

  private async saveAccessLevel(
    input: {
      name: string;
      departmentId: bigint | null;
      permissions?: string[];
    },
    actorId: bigint,
    id?: bigint,
  ) {
    const permissions = [
      ...new Set(
        (input.permissions ?? [])
          .map((permission) => permission.trim().toLowerCase())
          .filter((permission) =>
            (knownPermissions as readonly string[]).includes(permission),
          ),
      ),
    ];
    const result = await this.repository.saveAccessLevel(
      { ...input, permissions },
      actorId,
      id,
    );
    if ("duplicate" in result)
      throw new ConflictException(
        "An access level with this name already exists.",
      );
    if ("missingDepartment" in result)
      throw new BadRequestException({
        message: "Validation failed.",
        errors: { departmentId: ["The selected department does not exist."] },
      });
    if ("missingLevel" in result)
      throw new NotFoundException("Access level not found.");
    return jsonSafe({ ...result.level, permissions });
  }

  async deleteAccessLevel(id: bigint, actorId: bigint) {
    const result = await this.repository.deleteAccessLevel(id, actorId);
    if ("assigned" in result)
      throw new BadRequestException("Access level is assigned to users.");
    if ("missing" in result)
      throw new NotFoundException("Access level not found.");
    return { deleted: true };
  }

  async getRolePermissions() {
    const rows = await this.repository.listRolePermissions();
    return {
      groups: permissionGroups,
      roles: ["admin", "user"].map((role) => ({
        role,
        permissions: rows
          .filter((item) => item.role === role)
          .map((item) => item.permission),
      })),
    };
  }

  hasPermission(userId: bigint, permission: string): Promise<boolean> {
    const context = this.contexts.current(userId.toString());
    if (!context) return Promise.resolve(false);
    return this.can(context, permission, {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: context.businessUnitId,
    });
  }

  currentContext(userId: bigint) {
    return this.contexts.current(userId.toString());
  }

  async delegationGrants(
    context: SmartManagerAuthContext,
    permission: string,
  ): Promise<SmartManagerGrant[]> {
    const canonical = canonicalTenantPermission(permission);
    if (
      !(SMART_MANAGER_PERMISSION_KEYS as readonly string[]).includes(canonical)
    )
      return [];
    return this.repository.permissionGrants(context, canonical);
  }

  async departmentsForPermission(
    userId: bigint,
    permission: string,
  ): Promise<bigint[]> {
    const context = this.contexts.current(userId.toString());
    if (!context) return [];
    const canonical = canonicalTenantPermission(permission);
    if (
      !(SMART_MANAGER_PERMISSION_KEYS as readonly string[]).includes(canonical)
    )
      return [];
    const grants = await this.repository.permissionGrants(context, canonical);
    const departmentSets = await Promise.all(
      grants.map((grant) =>
        this.repository.departmentIdsForScope(
          context,
          grant.scopeType ?? context.scopeType,
          grant.domain,
        ),
      ),
    );
    return [...new Set(departmentSets.flat())];
  }

  async canAccessDepartment(
    userId: bigint,
    departmentId: bigint | null,
    _legacyGlobalScope: boolean,
    permission = "company.view",
  ): Promise<boolean> {
    if (departmentId === null) return false;
    const context = this.contexts.current(userId.toString());
    if (!context) return false;
    const user = await this.repository.findDepartmentAccess(userId);
    if (!user?.approvedAt) return false;
    const resource = await this.repository.resourceForDepartment(departmentId);
    return resource ? this.can(context, permission, resource) : false;
  }

  async canAccessKpi(
    userId: bigint,
    kpiId: bigint,
    permission: string,
  ): Promise<boolean> {
    const context = this.contexts.current(userId.toString());
    if (!context) return false;
    const target = await this.repository.kpiAuthorizationTarget(kpiId);
    if (!target) return false;
    const location = target.companyId
      ? {
          holdingId: target.holdingId.toString(),
          companyId: target.companyId.toString(),
          branchId: target.branchId?.toString() ?? null,
          businessUnitId: target.businessUnitId?.toString() ?? null,
          domain: target.domain,
        }
      : target.departmentId === null
        ? null
        : await this.repository.resourceForDepartment(target.departmentId);
    if (!location) return false;
    return this.can(context, permission, {
      ...location,
      ownerId: target.ownerUserId?.toString() ?? null,
      assignedUserId: target.reporterUserId?.toString() ?? null,
    });
  }

  async canAccessAction(
    userId: bigint,
    actionId: bigint,
    permission: string,
  ): Promise<boolean> {
    const context = this.contexts.current(userId.toString());
    if (!context) return false;
    const target = await this.repository.actionAuthorizationTarget(actionId);
    if (!target) return false;
    const location = await this.repository.resourceForDepartment(
      target.departmentId,
    );
    return location
      ? this.can(context, permission, {
          ...location,
          ownerId: target.ownerUserId.toString(),
          assignedUserId: target.approverUserId?.toString() ?? null,
        })
      : false;
  }

  async canAccessAlert(
    userId: bigint,
    alertId: bigint,
    permission: string,
  ): Promise<boolean> {
    const context = this.contexts.current(userId.toString());
    if (!context) return false;
    const target = await this.repository.alertAuthorizationTarget(alertId);
    if (!target || target.departmentId === null) return false;
    const location = await this.repository.resourceForDepartment(
      target.departmentId,
    );
    return location
      ? this.can(context, permission, {
          ...location,
          assignedUserId: target.assignedUserId?.toString() ?? null,
        })
      : false;
  }

  async canAccessUser(
    actorId: bigint,
    targetUserId: bigint,
    permission: string,
  ): Promise<boolean> {
    const context = this.contexts.current(actorId.toString());
    if (!context) return false;
    const target = await this.repository.findDepartmentAccess(targetUserId);
    if (!target) return false;
    const tenantLocations =
      await this.repository.userMembershipResources(targetUserId);
    for (const location of tenantLocations) {
      if (
        await this.can(context, permission, {
          holdingId: location.holdingId.toString(),
          companyId: location.companyId?.toString() ?? null,
          branchId: location.branchId?.toString() ?? null,
          businessUnitId: location.businessUnitId?.toString() ?? null,
          domain: location.domain,
          ownerId: targetUserId.toString(),
        })
      )
        return true;
    }
    if (target.departmentId === null) {
      return (
        actorId === targetUserId &&
        this.can(context, permission, {
          holdingId: context.holdingId,
          companyId: context.companyId,
          ownerId: targetUserId.toString(),
        })
      );
    }
    const location = await this.repository.resourceForDepartment(
      target.departmentId,
    );
    return location
      ? this.can(context, permission, {
          ...location,
          ownerId: targetUserId.toString(),
        })
      : false;
  }

  async syncRolePermissions(
    role: "admin" | "user",
    requested: string[],
    actorId: bigint,
    registeredPermissions: readonly string[] = knownPermissions,
  ) {
    const registered = new Set(
      registeredPermissions.map((permission) =>
        permission.trim().toLowerCase(),
      ),
    );
    const known = new Set(
      (knownPermissions as readonly string[]).filter((permission) =>
        registered.has(permission),
      ),
    );
    const permissions = [
      ...new Set(
        requested
          .map((permission) => permission.trim().toLowerCase())
          .filter((permission) => known.has(permission)),
      ),
    ];
    await this.repository.syncRolePermissions(role, permissions, actorId);
    return permissions;
  }
}
