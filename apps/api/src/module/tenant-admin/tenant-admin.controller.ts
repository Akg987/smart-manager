import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { TenantAdminService } from "./tenant-admin.service.js";
import {
  AcceptInvitationDto,
  AssignMembershipDto,
  CreateBranchDto,
  CreateBusinessUnitDto,
  CreateCompanyDto,
  CreateInvitationDto,
  UpdateBranchDto,
  UpdateBusinessUnitDto,
} from "./tenant-admin.dto.js";

@ApiTags("tenant administration")
@Controller("tenant-admin")
@UseGuards(SessionGuard)
export class TenantAdminController {
  constructor(private readonly tenantAdmin: TenantAdminService) {}

  @Get("companies") companies(@Req() req: AuthenticatedRequest) {
    return this.tenantAdmin.companies(req.currentUser.id);
  }

  @Post("companies") createCompany(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCompanyDto,
  ) {
    return this.tenantAdmin.createCompany(req.currentUser.id, body);
  }

  @Get("branches") branches(@Req() req: AuthenticatedRequest) {
    return this.tenantAdmin.branches(req.currentUser.id);
  }

  @Post("branches") createBranch(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateBranchDto,
  ) {
    return this.tenantAdmin.createBranch(req.currentUser.id, body);
  }

  @Patch("branches/:branchId") updateBranch(
    @Req() req: AuthenticatedRequest,
    @Param("branchId", ParseIntPipe) branchId: number,
    @Body() body: UpdateBranchDto,
  ) {
    return this.tenantAdmin.updateBranch(
      req.currentUser.id,
      BigInt(branchId),
      body,
    );
  }

  @Get("business-units") businessUnits(@Req() req: AuthenticatedRequest) {
    return this.tenantAdmin.businessUnits(req.currentUser.id);
  }

  @Post("business-units") createBusinessUnit(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateBusinessUnitDto,
  ) {
    return this.tenantAdmin.createBusinessUnit(req.currentUser.id, body);
  }

  @Patch("business-units/:businessUnitId") updateBusinessUnit(
    @Req() req: AuthenticatedRequest,
    @Param("businessUnitId", ParseIntPipe) businessUnitId: number,
    @Body() body: UpdateBusinessUnitDto,
  ) {
    return this.tenantAdmin.updateBusinessUnit(
      req.currentUser.id,
      BigInt(businessUnitId),
      body,
    );
  }

  @Get("memberships") memberships(@Req() req: AuthenticatedRequest) {
    return this.tenantAdmin.memberships(req.currentUser.id);
  }

  @Get("delegable-roles") delegableRoles(@Req() req: AuthenticatedRequest) {
    return this.tenantAdmin.delegableRoles(req.currentUser.id);
  }

  @Post("memberships") assignMembership(
    @Req() req: AuthenticatedRequest,
    @Body() body: AssignMembershipDto,
  ) {
    return this.tenantAdmin.assignMembership(req.currentUser.id, body);
  }

  @Delete("memberships/:membershipId") revokeMembership(
    @Req() req: AuthenticatedRequest,
    @Param("membershipId", ParseIntPipe) membershipId: number,
  ) {
    return this.tenantAdmin.revokeMembership(
      req.currentUser.id,
      BigInt(membershipId),
    );
  }

  @Get("invitations") invitations(
    @Req() req: AuthenticatedRequest,
    @Query("companyId") companyId?: string,
  ) {
    return this.tenantAdmin.invitations(req.currentUser.id, companyId);
  }

  @Post("invitations") createInvitation(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateInvitationDto,
  ) {
    return this.tenantAdmin.createInvitation(req.currentUser.id, body);
  }

  @Delete("invitations/:invitationId") revokeInvitation(
    @Req() req: AuthenticatedRequest,
    @Param("invitationId", ParseIntPipe) invitationId: number,
  ) {
    return this.tenantAdmin.revokeInvitation(
      req.currentUser.id,
      BigInt(invitationId),
    );
  }

  @Post("invitations/accept") acceptInvitation(
    @Req() req: AuthenticatedRequest,
    @Body() body: AcceptInvitationDto,
  ) {
    return this.tenantAdmin.acceptInvitation(req.currentUser.id, body.token);
  }
}
