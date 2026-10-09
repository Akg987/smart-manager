import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DecisionsController } from "./decisions.controller.js";
import { DecisionsRepository } from "./decisions.repository.js";
import { DecisionsService } from "./decisions.service.js";

@Module({
  imports: [SessionModule, AuthorizationModule],
  controllers: [DecisionsController],
  providers: [DecisionsRepository, DecisionsService],
  exports: [DecisionsService],
})
export class DecisionsModule {}
