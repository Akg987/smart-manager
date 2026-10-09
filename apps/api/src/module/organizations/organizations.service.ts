import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrganizationsRepository } from "./organizations.repository.js";
import { AuthorizationService } from "../authorization/authorization.service.js";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizations: OrganizationsRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  static normalizeCode(code: string): string {
    const latin = code
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    return latin
      .trim()
      .toLowerCase()
      .replace(/[ /]/g, "-")
      .replace(/[^a-z0-9_-]/g, "");
  }

  static isValidCode(code: string): boolean {
    return /^[a-z][a-z0-9_-]{1,31}$/.test(code);
  }

  async createDepartment(
    input: { name: string; code: string; managerUserId?: bigint | null },
    actorId: bigint,
  ) {
    const context = this.authorization.currentContext(actorId);
    if (
      !context?.companyId ||
      !/^\d+$/.test(context.holdingId) ||
      !/^\d+$/.test(context.companyId)
    )
      throw new ForbiddenException("Permission denied.");
    if (
      !(await this.authorization.can(context, "company.manage", {
        holdingId: context.holdingId,
        companyId: context.companyId,
        branchId: context.branchId,
        businessUnitId: context.businessUnitId,
      }))
    )
      throw new ForbiddenException("Permission denied.");
    if (
      input.managerUserId &&
      !(await this.organizations.managerBelongsToCompany(
        input.managerUserId,
        BigInt(context.holdingId),
        BigInt(context.companyId),
      ))
    )
      throw new BadRequestException(
        "The selected manager is not a member of this company.",
      );
    const code = OrganizationsService.normalizeCode(input.code);
    if (!OrganizationsService.isValidCode(code))
      throw new BadRequestException("Invalid department code.");
    return this.organizations.createDepartment({ ...input, code }, actorId, {
      holdingId: BigInt(context.holdingId),
      companyId: BigInt(context.companyId),
      membershipId: BigInt(context.membershipId),
    });
  }

  async updateDepartment(
    id: bigint,
    input: { name?: string; code?: string; managerUserId?: bigint | null },
    actorId: bigint,
  ) {
    const context = this.authorization.currentContext(actorId);
    if (
      !context?.companyId ||
      !(await this.authorization.canAccessDepartment(
        actorId,
        id,
        false,
        "company.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    if (
      input.managerUserId &&
      !(await this.organizations.managerBelongsToCompany(
        input.managerUserId,
        BigInt(context.holdingId),
        BigInt(context.companyId),
      ))
    )
      throw new BadRequestException(
        "The selected manager is not a member of this company.",
      );
    const code =
      input.code === undefined
        ? undefined
        : OrganizationsService.normalizeCode(input.code);
    if (code !== undefined && !OrganizationsService.isValidCode(code))
      throw new BadRequestException("Invalid department code.");
    const department = await this.organizations.updateDepartment(
      id,
      { ...input, ...(code === undefined ? {} : { code }) },
      actorId,
      {
        holdingId: BigInt(context.holdingId),
        companyId: BigInt(context.companyId),
        membershipId: BigInt(context.membershipId),
      },
    );
    if (!department) throw new NotFoundException("Department not found.");
    return department;
  }
}
