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
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { IsString, MaxLength } from "class-validator";
import { UploadedFastifyFile } from "../../common/decorators/uploaded-fastify-file.decorator.js";
import { FastifyFileInterceptor } from "../../common/interceptors/fastify-file.interceptor.js";
import { SessionGuard } from "../../common/session.guard.js";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { currentJalaliPeriod } from "../../shared/jalali.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import type {
  CreateKpiDto,
  CreateObservationDto,
  CreateRedFlagDto,
  CreateRedFlagRuleDto,
  EvaluateRedFlagRulesDto,
  ReviewCheckinDto,
  SubmitCheckinDto,
  UpdateKpiDto,
  UpdateRedFlagDto,
  UpdateRedFlagRuleDto,
} from "./kpi.dto.js";
import {
  parseKpiImportColumnMapping,
  type KpiImportPreview,
  previewKpiImport,
} from "./kpi-import-parser.js";
import { KpiManagementService } from "./kpi-management.service.js";

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
  @Post("import/preview")
  @UseInterceptors(FastifyFileInterceptor("file"))
  async previewImport(
    @Req() req: AuthenticatedRequest,
    @UploadedFastifyFile()
    file?: {
      buffer: Buffer;
      filename: string;
      mimetype: string;
      fields?: Record<string, string>;
    },
  ) {
    if (!file) throw new BadRequestException("Import file is required.");
    if (!req.authContext.companyId)
      throw new ForbiddenException(
        "Select a company within your active scope.",
      );
    let preview: KpiImportPreview;
    try {
      const mapping = parseKpiImportColumnMapping(file.fields?.columnMapping);
      preview = await previewKpiImport(file.filename, file.buffer, mapping);
    } catch (error) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw error;
    }
    const definitions = await this.service.findImportKpisByCodes(
      [...new Set(preview.validRows.map((row) => row.kpiCode))],
      BigInt(req.authContext.companyId),
    );
    const kpiIds = new Map(definitions.map((kpi) => [kpi.code, kpi.id]));
    const visibleRows = [];
    const permissionIssues = [];
    for (const row of preview.validRows) {
      const kpiId = kpiIds.get(row.kpiCode);
      if (
        !kpiId ||
        !(await this.authorization.canAccessKpi(
          req.currentUser.id,
          kpiId,
          "kpi.submit",
        ))
      ) {
        permissionIssues.push({
          rowNumber: row.rowNumber,
          field: "kpiCode",
          message: "KPI is unavailable for import in the active company.",
        });
        continue;
      }
      visibleRows.push({ ...row, kpiId: kpiId.toString() });
    }
    return {
      rowCount: preview.rowCount,
      validRows: visibleRows,
      issues: [...preview.issues, ...permissionIssues],
      canImport:
        visibleRows.length > 0 &&
        preview.issues.length === 0 &&
        permissionIssues.length === 0,
    };
  }
  @Post("import")
  @UseInterceptors(FastifyFileInterceptor("file"))
  async importRows(
    @Req() req: AuthenticatedRequest,
    @UploadedFastifyFile()
    file?: {
      buffer: Buffer;
      filename: string;
      mimetype: string;
      fields?: Record<string, string>;
    },
  ) {
    if (!file) throw new BadRequestException("Import file is required.");
    const preview = await this.previewImport(req, file);
    if (!preview.canImport)
      throw new BadRequestException(
        "Resolve all import validation issues before importing.",
      );
    const userAgent = req.headers["user-agent"];
    return this.service.importKpiRows({
      actorId: req.currentUser.id,
      companyId: BigInt(req.authContext.companyId as string),
      fileName: file.filename,
      rows: preview.validRows.map(({ kpiId, ...row }) => row),
      ipAddress: req.ip ?? null,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent ?? null,
    });
  }
  @Get("import/runs")
  listImportRuns(@Req() req: AuthenticatedRequest) {
    if (!req.authContext.companyId)
      throw new ForbiddenException("Select a company within your active scope.");
    return this.service.listKpiImportRuns(
      req.currentUser.id,
      BigInt(req.authContext.companyId),
    );
  }
  @Get("studio") studio(@Req() req: AuthenticatedRequest) {
    return this.service.studioBoard(req.currentUser.id);
  }
  @Get("form") form(@Req() req: AuthenticatedRequest) {
    return this.service.createForm(req.currentUser.id);
  }
  @Get("review-queue") reviewQueue(@Req() req: AuthenticatedRequest) {
    return this.service.reviewQueue(req.currentUser.id);
  }
  @Post("checkins/:id/review") reviewCheckin(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ReviewCheckinDto,
  ) {
    return this.service.reviewCheckin({
      checkinId: BigInt(id),
      actorId: req.currentUser.id,
      decision: body.decision,
      note: body.note,
    });
  }
  @Post("checkins/:id/lock") lockCheckin(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.lockCheckin(BigInt(id), req.currentUser.id);
  }
  @Post(":id/submit-review") submitDefinitionForReview(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.submitDefinitionForReview(
      BigInt(id),
      req.currentUser.id,
    );
  }
  @Post(":id/publish") publishDefinition(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.publishDefinition(BigInt(id), req.currentUser.id);
  }
  @Get("red-flags") redFlags(@Req() req: AuthenticatedRequest) {
    return this.service.redFlagBoard(req.currentUser.id);
  }
  @Post("red-flags") createRedFlag(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateRedFlagDto,
  ) {
    return this.service.createRedFlag({
      ...body,
      actorId: req.currentUser.id,
      kpiId: body.kpiId == null ? null : BigInt(body.kpiId),
    });
  }
  @Patch("red-flags/:id") updateRedFlag(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateRedFlagDto,
  ) {
    return this.service.updateRedFlag({
      ...body,
      id: BigInt(id),
      actorId: req.currentUser.id,
      ownerUserId:
        body.ownerUserId === undefined
          ? undefined
          : body.ownerUserId === null
            ? null
            : BigInt(body.ownerUserId),
    });
  }
  @Get("red-flag-rules") redFlagRules(@Req() req: AuthenticatedRequest) {
    return this.service.redFlagRuleBoard(req.currentUser.id);
  }
  @Post("red-flag-rules") createRedFlagRule(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateRedFlagRuleDto,
  ) {
    return this.service.createRedFlagRule({
      ...body,
      actorId: req.currentUser.id,
      businessUnitId:
        body.businessUnitId == null ? null : BigInt(body.businessUnitId),
      kpiId: body.kpiId == null ? null : BigInt(body.kpiId),
    });
  }
  @Patch("red-flag-rules/:id") updateRedFlagRule(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateRedFlagRuleDto,
  ) {
    return this.service.updateRedFlagRule({
      ...body,
      id: BigInt(id),
      actorId: req.currentUser.id,
    });
  }
  @Post("red-flag-rules/evaluate") evaluateRedFlagRules(
    @Req() req: AuthenticatedRequest,
    @Body() body: EvaluateRedFlagRulesDto,
  ) {
    return this.service.evaluateRedFlagRules(req.currentUser.id, body.period);
  }
  @Get(":id/history") history(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.kpiHistory(BigInt(id), req.currentUser.id);
  }
  @Get(":id/data") data(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Query("period") period?: string,
  ) {
    return this.service.kpiData(BigInt(id), req.currentUser.id, period);
  }
  @Get("observations") observations(
    @Req() req: AuthenticatedRequest,
    @Query("period") period?: string,
  ) {
    return this.service.listObservations(req.currentUser.id, period);
  }
  @Post("observations") createObservation(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateObservationDto,
  ) {
    return this.service.createObservation({
      actorId: req.currentUser.id,
      period: body.period,
      text: body.text,
      tags: body.tags,
      relatedKpiIds: body.relatedKpiIds?.map(BigInt),
    });
  }
  @Get("options/:group") options(@Param("group") group: string) {
    return this.service.listStudioOptions(optionGroup(group));
  }
  @Get(":id") detail(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.kpiDetail(BigInt(id), req.currentUser.id);
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
      businessUnitId:
        body.businessUnitId == null ? null : BigInt(body.businessUnitId),
      ownerUserId: body.ownerUserId == null ? null : BigInt(body.ownerUserId),
      dataOwnerUserId:
        body.dataOwnerUserId == null ? null : BigInt(body.dataOwnerUserId),
      reviewerUserId:
        body.reviewerUserId == null ? null : BigInt(body.reviewerUserId),
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
      dataOwnerUserId:
        body.dataOwnerUserId === undefined
          ? undefined
          : body.dataOwnerUserId === null
            ? null
            : BigInt(body.dataOwnerUserId),
      reporterUserId:
        body.reporterUserId === undefined
          ? undefined
          : body.reporterUserId === null
            ? null
            : BigInt(body.reporterUserId),
      reviewerUserId:
        body.reviewerUserId === undefined
          ? undefined
          : body.reviewerUserId === null
            ? null
            : BigInt(body.reviewerUserId),
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
