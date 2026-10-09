import {
  SMART_MANAGER_PERMISSION_KEYS,
  SMART_MANAGER_SYSTEM_ROLES,
} from "./smart-manager-catalog.js";

export type SmartManagerAuthContext = {
  userId: string;
  holdingId: string;
  membershipId: string;
  companyId: string | null;
  branchId: string | null;
  businessUnitId: string | null;
  roleIds: string[];
  scopeType: string;
};

export type SmartManagerResourceContext = {
  holdingId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  businessUnitId?: string | null;
  ownerId?: string | null;
  assignedUserId?: string | null;
  domain?: string | null;
};

export type SmartManagerGrant = {
  permission: string;
  scopeType: string | null;
  domain: string | null;
};

export function isDelegableRole(role: {
  key: string;
  isSystem: boolean;
}): boolean {
  return (
    !role.isSystem &&
    !(SMART_MANAGER_SYSTEM_ROLES as readonly string[]).includes(role.key) &&
    !/(^|[_-])(ROOT|SYSTEM)([_-]|$)/i.test(role.key)
  );
}

/** True only when the requested grant stays inside the container scope. */
export function scopeContainsScope(
  containerScope: string,
  requestedScope: string,
  container: SmartManagerResourceContext,
  requested: SmartManagerResourceContext,
  containerDomain?: string | null,
  requestedDomain?: string | null,
): boolean {
  if (!container.holdingId || container.holdingId !== requested.holdingId)
    return false;
  switch (containerScope) {
    case "holding":
      return (
        requestedScope !== "holding" ||
        container.holdingId === requested.holdingId
      );
    case "company":
      if (!container.companyId || container.companyId !== requested.companyId)
        return false;
      return [
        "company",
        "branch",
        "businessUnit",
        "own",
        "assigned",
        "domain",
      ].includes(requestedScope);
    case "branch":
      if (
        !container.branchId ||
        container.branchId !== requested.branchId ||
        container.companyId !== requested.companyId
      )
        return false;
      return requestedScope === "branch" || requestedScope === "businessUnit";
    case "businessUnit":
      return (
        !!container.businessUnitId &&
        container.businessUnitId === requested.businessUnitId &&
        container.companyId === requested.companyId &&
        requestedScope === "businessUnit"
      );
    case "domain":
      return (
        !!container.companyId &&
        container.companyId === requested.companyId &&
        !!containerDomain &&
        containerDomain === requestedDomain &&
        requestedScope === "domain"
      );
    default:
      // Own and assigned grants are tied to the delegator and cannot be re-delegated.
      return false;
  }
}

export function grantCoversResource(
  context: SmartManagerAuthContext,
  grant: SmartManagerGrant,
  resource: SmartManagerResourceContext,
): boolean {
  const scope = grant.scopeType ?? context.scopeType;
  switch (scope) {
    case "holding":
      return resource.holdingId === context.holdingId;
    case "company":
      return (
        !!context.companyId &&
        resource.companyId === context.companyId &&
        resource.holdingId === context.holdingId
      );
    case "branch":
      return (
        !!context.branchId &&
        resource.branchId === context.branchId &&
        resource.companyId === context.companyId &&
        resource.holdingId === context.holdingId
      );
    case "businessUnit":
      return (
        !!context.businessUnitId &&
        resource.businessUnitId === context.businessUnitId &&
        resource.companyId === context.companyId &&
        resource.holdingId === context.holdingId
      );
    case "own":
      return (
        resource.ownerId === context.userId &&
        resource.holdingId === context.holdingId &&
        (context.companyId === null || resource.companyId === context.companyId)
      );
    case "assigned":
      return (
        resource.assignedUserId === context.userId &&
        resource.holdingId === context.holdingId &&
        (context.companyId === null || resource.companyId === context.companyId)
      );
    case "domain":
      return (
        !!grant.domain &&
        resource.domain === grant.domain &&
        !!context.companyId &&
        resource.companyId === context.companyId &&
        resource.holdingId === context.holdingId
      );
    default:
      return false;
  }
}

export function canWithGrants(
  context: SmartManagerAuthContext | null | undefined,
  permission: string,
  resource: SmartManagerResourceContext,
  grants: readonly SmartManagerGrant[],
): boolean {
  if (
    !context ||
    !(SMART_MANAGER_PERMISSION_KEYS as readonly string[]).includes(permission)
  )
    return false;
  return grants.some(
    (grant) =>
      grant.permission === permission &&
      grantCoversResource(context, grant, resource),
  );
}
