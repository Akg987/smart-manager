import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { InboxController } from "./inbox.controller.js";
import { InboxAuditService } from "./inbox-audit.service.js";
import { InboxAuditRepository } from "./inbox-audit.repository.js";

@Module({
  imports: [SessionModule],
  controllers: [InboxController],
  providers: [InboxAuditRepository, InboxAuditService],
})
export class InboxAuditModule {}
