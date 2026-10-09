import { Module } from "@nestjs/common";
import { SessionGuard } from "./session.guard.js";
import { SessionRepository } from "./session.repository.js";
import { SessionService } from "./session.service.js";

@Module({
  providers: [SessionRepository, SessionService, SessionGuard],
  exports: [SessionService, SessionGuard],
})
export class SessionModule {}
