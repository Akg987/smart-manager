import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationController } from "./authorization.controller.js";
import { AuthorizationService } from "./authorization.service.js";
import { AuthorizationRepository } from "./authorization.repository.js";

@Module({
  imports: [SessionModule],
  controllers: [AuthorizationController],
  providers: [AuthorizationRepository, AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
