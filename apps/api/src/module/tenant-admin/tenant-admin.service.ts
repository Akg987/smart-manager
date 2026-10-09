import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { TenantScopeType } from "../../../../../src/db/schema.js";
import { SMART_MANAGER_SYSTEM_ROLES } from "../permissions/smart-manager-catalog.js";
import {
  isDelegableRole,
  scopeContainsScope,
  type SmartManagerResourceContext,
} from "../permissions/smart-manager-authorization.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { TenantAdminRepository } from "./tenant-admin.repository.js";
import { hashInvitationToken } from "./invitation-security.js";

const jsonSafe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;

@Injectable()
export class TenantAdminService {
  constructor(
    private readonly repository: TenantAdminRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  private context(actorId: bigint) {
    const context = this.authorization.currentContext(actorId);
    if (!context) throw new ForbiddenException("Permission denied.");
    return context;
  }

  private async require(
    actorId: bigint,
    permission: string,
    resource: SmartManagerResourceContext,
  ) {
    const context = this.context(actorId);
    if (
      !resource.holdingId ||
      !(await this.authorization.can(context, permission, resource))
    )
      throw new ForbiddenException("Permission denied.");
    return context;
  }

  async companies(actorId: bigint) {
    const context = this.context(actorId);
    await this.require(actorId, "company.view", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    return jsonSafe(
      await this.repository.listCompanies(
        BigInt(context.holdingId),
        context.companyId ? BigInt(context.companyId) : null,
      ),
    );
  }

  async createCompany(
    actorId: bigint,
    input: { name: string; code: string; calendar?: string; currency?: string },
  ) {
    const context = this.context(actorId);
    if (context.scopeType !== "holding" || context.companyId)
      throw new ForbiddenException("Permission denied.");
    await this.require(actorId, "company.manage", {
      holdingId: context.holdingId,
    });
    return jsonSafe(
      await this.repository.createCompany(
        {
          holdingId: BigInt(context.holdingId),
          name: input.name.trim(),
          code: input.code.trim().toLowerCase(),
          calendar: input.calendar ?? "jalali",
          currency: input.currency ?? "IRR",
        },
        actorId,
        BigInt(context.membershipId),
      ),
    );
  }

  async branches(actorId: bigint) {
    const context = this.context(actorId);
    if (!context.companyId)
      throw new BadRequestException("An active company is required.");
    await this.require(actorId, "branch.view", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    return jsonSafe(
      await this.repository.listBranches(BigInt(context.companyId)),
    );
  }

  async createBranch(actorId: bigint, input: { name: string; code: string }) {
    const context = this.context(actorId);
    if (!context.companyId)
      throw new BadRequestException("An active company is required.");
    await this.require(actorId, "branch.manage", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    return jsonSafe(
      await this.repository.createBranch(
        {
          companyId: BigInt(context.companyId),
          name: input.name.trim(),
          code: input.code.trim().toLowerCase(),
          managerUserId: null,
        },
        actorId,
        BigInt(context.holdingId),
        BigInt(context.membershipId),
      ),
    );
  }

  async updateBranch(
    actorId: bigint,
    branchId: bigint,
    input: { name?: string; code?: string },
  ) {
    const context = this.context(actorId);
    if (!context.companyId)
      throw new BadRequestException("An active company is required.");
    await this.require(actorId, "branch.manage", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    const updated = await this.repository.updateBranch(
      BigInt(context.companyId),
      branchId,
      {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.code === undefined
          ? {}
          : { code: input.code.trim().toLowerCase() }),
      },
      actorId,
      BigInt(context.holdingId),
      BigInt(context.membershipId),
    );
    if (!updated) throw new NotFoundException("Branch not found.");
    return jsonSafe(updated);
  }

  async businessUnits(actorId: bigint) {
    const context = this.context(actorId);
    if (!context.companyId)
      throw new BadRequestException("An active company is required.");
    await this.require(actorId, "unit.view", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    const rows = await this.repository.listBusinessUnits(
      BigInt(context.companyId),
    );
    return jsonSafe(
      rows.map(({ unit, branchName }) => ({ ...unit, branchName })),
    );
  }

  async createBusinessUnit(
    actorId: bigint,
    input: {
      name: string;
      code: string;
      branchId?: string | null;
      domain?: string;
    },
  ) {
    const context = this.context(actorId);
    if (!context.companyId)
      throw new BadRequestException("An active company is required.");
    await this.require(actorId, "unit.manage", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    const branchId = input.branchId ? BigInt(input.branchId) : null;
    if (
      branchId &&
      !(
        await this.repository.findBranch(BigInt(context.companyId), branchId)
      )[0]
    )
      throw new BadRequestException(
        "Branch does not belong to the active company.",
      );
    return jsonSafe(
      await this.repository.createBusinessUnit(
        {
          companyId: BigInt(context.companyId),
          branchId,
          name: input.name.trim(),
          code: input.code.trim().toLowerCase(),
          managerUserId: null,
          domain: input.domain?.trim() || "general",
        },
        actorId,
        BigInt(context.holdingId),
        BigInt(context.membershipId),
      ),
    );
  }

  async updateBusinessUnit(
    actorId: bigint,
    businessUnitId: bigint,
    input: {
      name?: string;
      code?: string;
      branchId?: string | null;
      domain?: string;
    },
  ) {
    const context = this.context(actorId);
    if (!context.companyId)
      throw new BadRequestException("An active company is required.");
    await this.require(actorId, "unit.manage", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    let branchId: bigint | null | undefined;
    if (input.branchId !== undefined) {
      branchId = input.branchId ? BigInt(input.branchId) : null;
      if (
        branchId &&
        !(
          await this.repository.findBranch(BigInt(context.companyId), branchId)
        )[0]
      )
        throw new BadRequestException(
          "Branch does not belong to the active company.",
        );
    }
    const updated = await this.repository.updateBusinessUnit(
      BigInt(context.companyId),
      businessUnitId,
      {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.code === undefined
          ? {}
          : { code: input.code.trim().toLowerCase() }),
        ...(branchId === undefined ? {} : { branchId }),
        ...(input.domain === undefined
          ? {}
          : { domain: input.domain.trim() || "general" }),
      },
      actorId,
      BigInt(context.holdingId),
      BigInt(context.membershipId),
    );
    if (!updated) throw new NotFoundException("Business unit not found.");
    return jsonSafe(updated);
  }

  async memberships(actorId: bigint) {
    const context = this.context(actorId);
    await this.require(actorId, "users.view", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    const rows = await this.repository.listMemberships(
      BigInt(context.holdingId),
      context.companyId ? BigInt(context.companyId) : null,
    );
    const actorLocation: SmartManagerResourceContext = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: context.businessUnitId,
    };
    return jsonSafe(
      rows.filter(({ membership }) =>
        scopeContainsScope(
          context.scopeType,
          membership.scopeType,
          actorLocation,
          {
            holdingId: membership.holdingId.toString(),
            companyId: membership.companyId?.toString() ?? null,
            branchId: membership.branchId?.toString() ?? null,
            businessUnitId: membership.businessUnitId?.toString() ?? null,
          },
        ),
      ),
    );
  }

  async delegableRoles(actorId: bigint) {
    const context = this.context(actorId);
    const actorLocation: SmartManagerResourceContext = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: context.businessUnitId,
    };
    await this.require(actorId, "users.manage", actorLocation);
    const definitions = await this.repository.listDelegableRoleDefinitions(
      BigInt(context.holdingId),
    );
    const eligible = [];
    for (const { role, grants } of definitions) {
      if (!isDelegableRole(role) || grants.length === 0) continue;
      let allowed = true;
      const permissions: {
        key: string;
        scopeType: string;
        domain: string | null;
      }[] = [];
      for (const grant of grants) {
        const delegatedScope = grant.scopeType ?? context.scopeType;
        const actorGrants = await this.authorization.delegationGrants(
          context,
          grant.permission,
        );
        const covered = actorGrants.some((actorGrant) => {
          const actorGrantScope = actorGrant.scopeType ?? context.scopeType;
          return (
            scopeContainsScope(
              context.scopeType,
              delegatedScope,
              actorLocation,
              actorLocation,
              actorGrant.domain,
              grant.domain,
            ) &&
            scopeContainsScope(
              actorGrantScope,
              delegatedScope,
              actorLocation,
              actorLocation,
              actorGrant.domain,
              grant.domain,
            )
          );
        });
        if (!covered) {
          allowed = false;
          break;
        }
        permissions.push({
          key: grant.permission,
          scopeType: delegatedScope,
          domain: grant.domain,
        });
      }
      if (allowed)
        eligible.push({
          id: role.id,
          key: role.key,
          name: role.name,
          permissions,
        });
    }
    return jsonSafe(eligible);
  }

  async invitations(actorId: bigint, requestedCompanyId?: string) {
    const context = this.context(actorId);
    const companyId = context.companyId
      ? BigInt(context.companyId)
      : requestedCompanyId
        ? BigInt(requestedCompanyId)
        : null;
    if (
      !companyId ||
      (context.companyId &&
        requestedCompanyId &&
        BigInt(requestedCompanyId) !== companyId)
    )
      throw new BadRequestException("An active company is required.");
    const [company] = await this.repository.findCompany(
      BigInt(context.holdingId),
      companyId,
    );
    if (!company) throw new NotFoundException("Company not found.");
    await this.require(actorId, "users.view", {
      holdingId: context.holdingId,
      companyId: companyId.toString(),
    });
    return jsonSafe(
      await this.repository.listInvitations(
        BigInt(context.holdingId),
        companyId,
      ),
    );
  }

  async createInvitation(
    actorId: bigint,
    input: { mobile: string; roleId: string; companyId?: string },
  ) {
    const context = this.context(actorId);
    const companyId = context.companyId
      ? BigInt(context.companyId)
      : input.companyId
        ? BigInt(input.companyId)
        : null;
    if (
      !companyId ||
      (context.companyId &&
        input.companyId &&
        BigInt(input.companyId) !== companyId)
    )
      throw new ForbiddenException("Permission denied.");
    const [company] = await this.repository.findCompany(
      BigInt(context.holdingId),
      companyId,
    );
    if (!company) throw new NotFoundException("Company not found.");
    const target: SmartManagerResourceContext = {
      holdingId: context.holdingId,
      companyId: companyId.toString(),
      branchId: null,
      businessUnitId: null,
    };
    const actorLocation: SmartManagerResourceContext = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: context.businessUnitId,
    };
    if (
      !scopeContainsScope(context.scopeType, "company", actorLocation, target)
    )
      throw new ForbiddenException("Permission denied.");
    await this.require(actorId, "users.manage", target);

    const roleId = BigInt(input.roleId);
    const definitions = await this.repository.roleDefinitions(
      BigInt(context.holdingId),
      [roleId],
    );
    const definition = definitions[0];
    if (!definition || !isDelegableRole(definition.role))
      throw new ForbiddenException(
        "System and root roles cannot be delegated.",
      );
    if (!definition.grants.length)
      throw new BadRequestException(
        "A role without permissions cannot be delegated.",
      );
    const permissions: {
      key: string;
      scopeType: string;
      domain: string | null;
    }[] = [];
    for (const grant of definition.grants) {
      const delegatedScope = grant.scopeType ?? "company";
      if (
        !scopeContainsScope(
          "company",
          delegatedScope,
          target,
          target,
          null,
          grant.domain,
        )
      )
        throw new ForbiddenException(
          "Role permissions exceed the invitation company scope.",
        );
      const actorGrants = await this.authorization.delegationGrants(
        context,
        grant.permission,
      );
      const allowed = actorGrants.some((actorGrant) => {
        const actorGrantScope = actorGrant.scopeType ?? context.scopeType;
        return (
          scopeContainsScope(
            context.scopeType,
            delegatedScope,
            actorLocation,
            target,
            actorGrant.domain,
            grant.domain,
          ) &&
          scopeContainsScope(
            actorGrantScope,
            delegatedScope,
            actorLocation,
            target,
            actorGrant.domain,
            grant.domain,
          )
        );
      });
      if (!allowed)
        throw new ForbiddenException(
          "Role permissions exceed the delegator's current permissions or scope.",
        );
      permissions.push({
        key: grant.permission,
        scopeType: delegatedScope,
        domain: grant.domain,
      });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await this.repository.createInvitation(
      {
        holdingId: BigInt(context.holdingId),
        companyId,
        mobile: input.mobile,
        tokenHash: hashInvitationToken(token),
        roleId,
        expiresAt,
        roleSnapshot: {
          id: definition.role.id.toString(),
          key: definition.role.key,
          permissions,
        },
      },
      actorId,
      BigInt(context.membershipId),
    );
    return jsonSafe({
      invitation: {
        id: invitation.id,
        mobile: invitation.mobile,
        roleId: invitation.roleId,
        expiresAt: invitation.expiresAt,
      },
      token,
    });
  }

  async revokeInvitation(actorId: bigint, invitationId: bigint) {
    const context = this.context(actorId);
    if (!context.companyId)
      throw new BadRequestException("An active company is required.");
    const [invitation] = await this.repository.findInvitation(
      BigInt(context.holdingId),
      BigInt(context.companyId),
      invitationId,
    );
    if (!invitation) throw new NotFoundException("Invitation not found.");
    await this.require(actorId, "users.manage", {
      holdingId: context.holdingId,
      companyId: context.companyId,
    });
    const revoked = await this.repository.revokeInvitation(
      invitationId,
      actorId,
      BigInt(context.holdingId),
      BigInt(context.companyId),
      BigInt(context.membershipId),
    );
    if (!revoked) throw new NotFoundException("Invitation not found.");
    return jsonSafe(revoked);
  }

  async acceptInvitation(userId: bigint, token: string) {
    const result = await this.repository.acceptInvitation(
      userId,
      hashInvitationToken(token),
    );
    if ("invalid" in result)
      throw new BadRequestException(
        "Invitation is invalid, expired, revoked, or belongs to another mobile number.",
      );
    return jsonSafe(result);
  }

  async assignMembership(
    actorId: bigint,
    input: {
      userId: string;
      companyId?: string;
      branchId?: string;
      businessUnitId?: string;
      scopeType: "company" | "branch" | "businessUnit";
      roleIds: string[];
    },
  ) {
    const context = this.context(actorId);
    const recipientId = BigInt(input.userId);
    if (recipientId === actorId)
      throw new BadRequestException(
        "You cannot assign a membership to yourself.",
      );
    const companyId = context.companyId
      ? BigInt(context.companyId)
      : input.companyId
        ? BigInt(input.companyId)
        : null;
    if (
      !companyId ||
      (context.companyId &&
        input.companyId &&
        BigInt(input.companyId) !== companyId)
    )
      throw new ForbiddenException("Permission denied.");
    const branchIdInput = input.branchId ? BigInt(input.branchId) : null;
    let branchId = branchIdInput;
    let businessUnitId = input.businessUnitId
      ? BigInt(input.businessUnitId)
      : null;
    let targetDomain: string | null = null;
    if (branchId && !(await this.repository.findBranch(companyId, branchId))[0])
      throw new BadRequestException(
        "Branch does not belong to the active company.",
      );
    if (businessUnitId) {
      const [unit] = await this.repository.findBusinessUnit(
        companyId,
        businessUnitId,
      );
      if (
        !unit ||
        (branchIdInput && unit.branchId !== branchIdInput) ||
        (!branchIdInput && unit.branchId)
      )
        throw new BadRequestException(
          "Business unit does not belong to the selected company and branch.",
        );
      branchId = unit.branchId;
      targetDomain = unit.domain;
    }
    if (input.scopeType === "company" && (branchId || businessUnitId))
      throw new BadRequestException(
        "Company scope cannot include a branch or business unit.",
      );
    if (input.scopeType === "branch" && (!branchId || businessUnitId))
      throw new BadRequestException(
        "Branch scope requires a branch and cannot include a business unit.",
      );
    if (input.scopeType === "businessUnit" && !businessUnitId)
      throw new BadRequestException(
        "Business unit scope requires a business unit.",
      );

    const target: SmartManagerResourceContext = {
      holdingId: context.holdingId,
      companyId: companyId.toString(),
      branchId: branchId?.toString() ?? null,
      businessUnitId: businessUnitId?.toString() ?? null,
      domain: targetDomain,
    };
    const actorLocation: SmartManagerResourceContext = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: context.branchId,
      businessUnitId: context.businessUnitId,
    };
    const targetScope = input.scopeType as TenantScopeType;
    if (
      !scopeContainsScope(context.scopeType, targetScope, actorLocation, target)
    )
      throw new ForbiddenException("Permission denied.");
    await this.require(actorId, "users.manage", target);

    const roleIds = [...new Set(input.roleIds.map((id) => BigInt(id)))];
    const definitions = await this.repository.roleDefinitions(
      BigInt(context.holdingId),
      roleIds,
    );
    if (definitions.length !== roleIds.length)
      throw new BadRequestException(
        "One or more roles are unavailable in this holding.",
      );
    if (definitions.some(({ role }) => !isDelegableRole(role)))
      throw new ForbiddenException(
        "System and root roles cannot be delegated.",
      );

    const roleSnapshot = [] as {
      id: string;
      key: string;
      permissions: { key: string; scopeType: string; domain: string | null }[];
    }[];
    for (const { role, grants } of definitions) {
      const snapshot = {
        id: role.id.toString(),
        key: role.key,
        permissions: [] as {
          key: string;
          scopeType: string;
          domain: string | null;
        }[],
      };
      for (const grant of grants) {
        const delegatedScope = grant.scopeType ?? targetScope;
        if (
          !scopeContainsScope(
            targetScope,
            delegatedScope,
            target,
            target,
            targetDomain,
            grant.domain,
          )
        )
          throw new ForbiddenException(
            "Role permissions exceed the assigned membership scope.",
          );
        const actorGrants = await this.authorization.delegationGrants(
          context,
          grant.permission,
        );
        const withinActorScope = actorGrants.some((actorGrant) => {
          const actorGrantScope = actorGrant.scopeType ?? context.scopeType;
          return (
            scopeContainsScope(
              context.scopeType,
              delegatedScope,
              actorLocation,
              target,
              actorGrant.domain,
              grant.domain,
            ) &&
            scopeContainsScope(
              actorGrantScope,
              delegatedScope,
              actorLocation,
              target,
              actorGrant.domain,
              grant.domain,
            )
          );
        });
        if (!withinActorScope)
          throw new ForbiddenException(
            "Role permissions exceed the delegator's current permissions or scope.",
          );
        snapshot.permissions.push({
          key: grant.permission,
          scopeType: delegatedScope,
          domain: grant.domain,
        });
      }
      roleSnapshot.push(snapshot);
    }

    const result = await this.repository.assignMembership(
      {
        userId: recipientId,
        holdingId: BigInt(context.holdingId),
        companyId,
        branchId,
        businessUnitId,
        scopeType: targetScope,
        roleIds,
        roleSnapshot,
      },
      actorId,
      BigInt(context.membershipId),
    );
    if ("missingUser" in result) throw new NotFoundException("User not found.");
    return jsonSafe(result.membership);
  }

  async revokeMembership(actorId: bigint, membershipId: bigint) {
    const context = this.context(actorId);
    if (!context.companyId)
      throw new BadRequestException("An active company is required.");
    const [target] = await this.repository.findMembership(
      BigInt(context.holdingId),
      BigInt(context.companyId),
      membershipId,
    );
    if (!target) throw new NotFoundException("Membership not found.");
    if (target.membership.userId === actorId)
      throw new BadRequestException("You cannot revoke your own membership.");
    const targetLocation: SmartManagerResourceContext = {
      holdingId: context.holdingId,
      companyId: context.companyId,
      branchId: target.membership.branchId?.toString() ?? null,
      businessUnitId: target.membership.businessUnitId?.toString() ?? null,
    };
    if (
      !scopeContainsScope(
        context.scopeType,
        target.membership.scopeType,
        {
          holdingId: context.holdingId,
          companyId: context.companyId,
          branchId: context.branchId,
          businessUnitId: context.businessUnitId,
        },
        targetLocation,
      )
    )
      throw new ForbiddenException("Permission denied.");
    await this.require(actorId, "users.manage", targetLocation);
    const revoked = await this.repository.revokeMembership(
      membershipId,
      actorId,
      BigInt(context.holdingId),
      BigInt(context.companyId),
      BigInt(context.membershipId),
    );
    if (!revoked) throw new NotFoundException("Membership not found.");
    return jsonSafe(revoked);
  }
}
