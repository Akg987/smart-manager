import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DataController } from "./data.controller.js";
import { DataService } from "./data.service.js";
import { DataRepository } from "./data.repository.js";

@Module({
  imports: [SessionModule, AuthorizationModule],
  controllers: [DataController],
  providers: [DataRepository, DataService],
})
export class DataModule {}
