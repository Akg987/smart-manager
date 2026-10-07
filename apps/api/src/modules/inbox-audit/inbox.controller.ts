import {
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { InboxAuditService } from "./inbox-audit.service.js";
@Controller("notifications")
@UseGuards(SessionGuard)
export class InboxController {
  constructor(private readonly inbox: InboxAuditService) {}
  @Patch(":id/read") read(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.inbox.markRead(req.currentUser.id, BigInt(id));
  }
  @Patch("read-all") readAll(@Req() req: AuthenticatedRequest) {
    return this.inbox.markAllRead(req.currentUser.id);
  }
}
