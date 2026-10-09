import { Module } from "@nestjs/common";
import { SessionModule } from "../../common/session.module.js";
import { AuthModule } from "../auth/runtime/auth.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { UsersController } from "./users.controller.js";
import { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";

@Module({
  imports: [SessionModule, AuthModule, AuthorizationModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
