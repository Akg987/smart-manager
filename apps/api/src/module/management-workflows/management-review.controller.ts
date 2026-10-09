import {
  BadRequestException,
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
  CloseManagementReviewDto,
  CreateManagementReviewDto,
  UpdateManagementReviewDto,
} from "./management-review.dto.js";
import { ManagementReviewService } from "./management-review.service.js";

@Controller("management-reviews")
@UseGuards(SessionGuard)
export class ManagementReviewController {
  constructor(private readonly service: ManagementReviewService) {}

  @Get() list(
    @Req() req: AuthenticatedRequest,
    @Query("type") type?: string,
    @Query("period") period?: string,
  ) {
    if (type && type !== "wbr" && type !== "mbr")
      throw new BadRequestException("Review type must be wbr or mbr.");
    return this.service.list(
      req.currentUser.id,
      type as "wbr" | "mbr" | undefined,
      period,
    );
  }
  @Get("templates") templates() {
    return this.service.templates();
  }
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateManagementReviewDto,
  ) {
    return this.service.create(req.currentUser.id, {
      ...body,
      businessUnitId:
        body.businessUnitId == null ? undefined : BigInt(body.businessUnitId),
    });
  }
  @Patch(":id") update(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateManagementReviewDto,
  ) {
    return this.service.update(req.currentUser.id, BigInt(id), body);
  }
  @Post(":id/publish") publish(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.publish(req.currentUser.id, BigInt(id));
  }
  @Post(":id/close") close(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CloseManagementReviewDto,
  ) {
    return this.service.close(
      req.currentUser.id,
      BigInt(id),
      body.closureSummary,
    );
  }
  @Get(":id/export") export(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.export(req.currentUser.id, BigInt(id));
  }
}
