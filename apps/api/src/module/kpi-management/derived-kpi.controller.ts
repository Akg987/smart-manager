import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import {
  CalculateDerivedKpiDto,
  DerivedKpiDto,
  FormulaValidateDto,
  UpdateDerivedKpiDto,
} from "./derived-kpi.dto.js";
import { DerivedKpiService } from "./derived-kpi.service.js";

@Controller("formulas")
@UseGuards(SessionGuard)
export class DerivedKpiController {
  constructor(private readonly service: DerivedKpiService) {}

  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.currentUser.id);
  }
  @Get("source-kpis") sources(@Req() req: AuthenticatedRequest) {
    return this.service.sources(req.currentUser.id);
  }
  @Post("validate") validate(
    @Req() req: AuthenticatedRequest,
    @Body() body: FormulaValidateDto,
  ) {
    return this.service.validate(req.currentUser.id, {
      ...body,
      businessUnitId:
        body.businessUnitId === undefined
          ? undefined
          : body.businessUnitId === null
            ? null
            : BigInt(body.businessUnitId),
    });
  }
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Body() body: DerivedKpiDto,
  ) {
    return this.service.create(req.currentUser.id, {
      ...body,
      businessUnitId:
        body.businessUnitId === undefined
          ? undefined
          : body.businessUnitId === null
            ? null
            : BigInt(body.businessUnitId),
      ownerUserId: body.ownerUserId == null ? null : BigInt(body.ownerUserId),
    });
  }
  @Get(":id/history") history(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.history(req.currentUser.id, BigInt(id));
  }
  @Get(":id/drilldown") drilldown(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Query("period") period = "",
  ) {
    return this.service.drilldown(req.currentUser.id, BigInt(id), period);
  }
  @Get(":id") detail(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.detail(req.currentUser.id, BigInt(id));
  }
  @Patch(":id") update(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateDerivedKpiDto,
  ) {
    return this.service.update(req.currentUser.id, BigInt(id), {
      ...body,
      businessUnitId:
        body.businessUnitId === undefined
          ? undefined
          : body.businessUnitId === null
            ? null
            : BigInt(body.businessUnitId),
      ownerUserId:
        body.ownerUserId === undefined
          ? undefined
          : body.ownerUserId === null
            ? null
            : BigInt(body.ownerUserId),
    });
  }
  @Post(":id/publish") publish(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.publish(req.currentUser.id, BigInt(id));
  }
  @Post(":id/calculate") calculate(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CalculateDerivedKpiDto,
  ) {
    return this.service.calculate(req.currentUser.id, BigInt(id), body.period);
  }
}
