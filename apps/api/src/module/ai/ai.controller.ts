import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SessionGuard } from "../../common/session.guard.js";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { AiChatDto, ReviewAiRecommendationDto } from "./ai.dto.js";
import { AiService } from "./ai.service.js";

@Controller("ai")
@UseGuards(SessionGuard)
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get("context") context(@Req() req: AuthenticatedRequest) {
    return this.service.context(req.currentUser.id);
  }

  @Get("conversations") conversations(@Req() req: AuthenticatedRequest) {
    return this.service.conversations(req.currentUser.id);
  }

  @Get("conversations/:id") async conversation(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const row = await this.service.conversation(req.currentUser.id, BigInt(id));
    if (!row) throw new NotFoundException("Conversation not found.");
    return row;
  }

  @Post("chat") chat(
    @Req() req: AuthenticatedRequest,
    @Body() body: AiChatDto,
  ) {
    return this.service.chat(req.currentUser.id, body);
  }

  @Post(
    "conversations/:conversationId/recommendations/:recommendationId/review",
  )
  reviewRecommendation(
    @Req() req: AuthenticatedRequest,
    @Param("conversationId", ParseIntPipe) conversationId: number,
    @Param("recommendationId", ParseIntPipe) recommendationId: number,
    @Body() body: ReviewAiRecommendationDto,
  ) {
    if (!["accepted", "rejected"].includes(body.decision))
      throw new ForbiddenException("Invalid recommendation decision.");
    return this.service.reviewRecommendation(
      req.currentUser.id,
      BigInt(conversationId),
      BigInt(recommendationId),
      body,
    );
  }
}
