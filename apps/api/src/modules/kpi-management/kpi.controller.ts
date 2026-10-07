import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsString, MaxLength } from "class-validator";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { KpiManagementService } from "./kpi-management.service.js";
import { CreateKpiDto, SubmitCheckinDto, UpdateKpiDto } from "./kpi.dto.js";
import { currentJalaliPeriod } from "../../shared/jalali.js";
import { AuthorizationService } from "../authorization/authorization.service.js";

class OptionNameDto {
  @IsString() @MaxLength(80) name!: string;
}
const optionGroups = ["input_mode", "direction", "frequency"] as const;
type OptionGroup = (typeof optionGroups)[number];
function optionGroup(value: string): OptionGroup {
  if ((optionGroups as readonly string[]).includes(value))
    return value as OptionGroup;
  throw new BadRequestException("Unknown option group.");
}

@Controller("kpis")
@UseGuards(SessionGuard)
export class KpiController {
  constructor(
    private readonly service: KpiManagementService,
    private readonly authorization: AuthorizationService,
  ) {}
  @Get() dashboard(@Req() req: AuthenticatedRequest) {
    return this.service.dashboardSnapshot(req.currentUser.id);
  }
  @Get("studio") studio(@Req() req: AuthenticatedRequest) {
    return this.service.studioBoard(req.currentUser.id);
  }
  @Get("form") form(@Req() req: AuthenticatedRequest) {
    return this.service.createForm(req.currentUser.id);
  }
  @Get("options/:group") options(@Param("group") group: string) {
    return this.service.listStudioOptions(optionGroup(group));
  }
  @Post("options/:group") async addOption(
    @Req() req: AuthenticatedRequest,
    @Param("group") group: string,
    @Body() body: OptionNameDto,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "kpi.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.service.addStudioOption(optionGroup(group), body.name);
  }
  @Patch("options/:id") async renameOption(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: OptionNameDto,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "kpi.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.service.renameStudioOption(BigInt(id), body.name);
  }
  @Delete("options/:id") async deleteOption(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "kpi.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.service.deleteStudioOption(BigInt(id));
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: CreateKpiDto) {
    return this.service.createDefinition({
      ...body,
      actorId: req.currentUser.id,
      departmentId: BigInt(body.departmentId),
      ownerUserId: body.ownerUserId == null ? null : BigInt(body.ownerUserId),
      reporterUserId:
        body.reporterUserId == null ? null : BigInt(body.reporterUserId),
    });
  }
  @Put(":id") update(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateKpiDto,
  ) {
    return this.service.updateDefinition(BigInt(id), req.currentUser.id, {
      ...body,
      ownerUserId: body.ownerUserId == null ? null : BigInt(body.ownerUserId),
    });
  }
  @Post(":id/checkins") checkin(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: SubmitCheckinDto,
  ) {
    return this.service.submitCheckin({
      ...body,
      period: body.period || currentJalaliPeriod(),
      kpiId: BigInt(id),
      userId: req.currentUser.id,
      actualValue: body.actualValue ?? null,
    });
  }
}
