import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionService } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { FastifyFileInterceptor } from "../../common/interceptors/fastify-file.interceptor.js";
import { UploadedFastifyFile } from "../../common/decorators/uploaded-fastify-file.decorator.js";
import { SkipResponseWrap } from "../../common/decorators/skip-response-wrap.decorator.js";
import { UsersService } from "./users.service.js";
import {
  AssignOrganizationDto,
  UpdateProfileDto,
  UpdateRoleDto,
} from "./users.dto.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { AuthService } from "../auth/runtime/auth.service.js";
import { hash } from "bcryptjs";
import { UpdatePasswordDto } from "./profile.dto.js";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

@ApiTags("users")
@Controller("users")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly authorization: AuthorizationService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}
  @Get("me") async me(@Req() req: AuthenticatedRequest) {
    const { password, rememberToken, ...safe } = req.currentUser;
    const departmentName = await this.users.departmentName(safe.departmentId);
    return {
      user: {
        ...safe,
        id: safe.id.toString(),
        departmentId: safe.departmentId?.toString() ?? null,
        accessLevelId: safe.accessLevelId?.toString() ?? null,
        approvedBy: safe.approvedBy?.toString() ?? null,
        departmentName,
      },
    };
  }
  @Patch("me") updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateProfileDto,
  ) {
    return this.users.updateProfile(req.currentUser.id, body);
  }
  @Post("me/password") async updatePassword(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() body: UpdatePasswordDto,
  ) {
    if (body.password !== body.password_confirmation)
      throw new BadRequestException({
        message: "Validation failed.",
        errors: {
          password_confirmation: ["The password confirmation does not match."],
        },
      });
    if (body.password === body.current_password)
      throw new BadRequestException({
        message: "Validation failed.",
        errors: {
          password: ["The new password must differ from the current password."],
        },
      });
    if (
      !(await this.auth.validatePassword(
        body.current_password,
        req.currentUser.password,
      ))
    )
      throw new BadRequestException({
        message: "Validation failed.",
        errors: { current_password: ["The current password is incorrect."] },
      });
    await this.users.setPassword(
      req.currentUser.id,
      await hash(body.password, 10),
    );
    await this.sessions.regenerate(req, res, req.currentUser.id);
    return { message: "Password updated." };
  }
  @Post("me/avatar")
  @UseInterceptors(FastifyFileInterceptor("avatar"))
  async updateAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFastifyFile() file: { buffer: Buffer } | undefined,
  ) {
    if (!file)
      throw new BadRequestException({
        message: "Validation failed.",
        errors: { avatar: ["A JPG, PNG or WebP avatar is required."] },
      });
    const ext = this.validateAvatar(file);
    const directory = join(
      resolve(process.env.UPLOAD_DIR ?? "storage/uploads"),
      "avatars",
      req.currentUser.id.toString(),
    );
    await mkdir(directory, { recursive: true });
    const name = `${randomBytes(20).toString("hex")}.${ext}`;
    const path = `avatars/${req.currentUser.id}/${name}`;
    await writeFile(join(directory, name), file.buffer, { flag: "wx" });
    const previous = req.currentUser.avatarPath;
    try {
      await this.users.setAvatar(req.currentUser.id, path);
    } catch (error) {
      await unlink(join(directory, name)).catch(() => undefined);
      throw error;
    }
    if (previous?.startsWith(`avatars/${req.currentUser.id}/`))
      await unlink(
        join(resolve(process.env.UPLOAD_DIR ?? "storage/uploads"), previous),
      ).catch(() => undefined);
    return {
      message: "Avatar updated.",
      avatarUrl: `/api/users/${req.currentUser.id}/avatar`,
    };
  }
  @Delete("me/avatar") async deleteAvatar(@Req() req: AuthenticatedRequest) {
    const previous = req.currentUser.avatarPath;
    await this.users.setAvatar(req.currentUser.id, null);
    if (
      previous &&
      /^avatars\/\d+\/[a-f0-9]{40}\.(jpg|png|webp)$/.test(previous) &&
      previous.startsWith(`avatars/${req.currentUser.id}/`)
    ) {
      await unlink(
        join(resolve(process.env.UPLOAD_DIR ?? "storage/uploads"), previous),
      ).catch(() => undefined);
    }
    return { message: "Avatar removed." };
  }
  @Get(":id/avatar") @SkipResponseWrap() async avatar(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Res() reply: FastifyReply,
  ) {
    if (
      !(await this.authorization.canAccessUser(
        req.currentUser.id,
        BigInt(id),
        "users.view",
      ))
    )
      throw new NotFoundException("Avatar not found.");
    const [user] = await this.users.findById(BigInt(id));
    if (
      !user?.avatarPath ||
      !/^avatars\/\d+\/[a-f0-9]{40}\.(jpg|png|webp)$/.test(user.avatarPath)
    )
      throw new NotFoundException("Avatar not found.");
    const path = resolve(
      process.env.UPLOAD_DIR ?? "storage/uploads",
      user.avatarPath,
    );
    if (
      !path.startsWith(
        resolve(process.env.UPLOAD_DIR ?? "storage/uploads") + "\\",
      ) &&
      !path.startsWith(
        resolve(process.env.UPLOAD_DIR ?? "storage/uploads") + "/",
      )
    )
      throw new NotFoundException("Avatar not found.");
    const data = await readFile(path).catch(() => {
      throw new NotFoundException("Avatar not found.");
    });
    return reply
      .header("Cache-Control", "private, max-age=86400")
      .type(
        extname(path) === ".jpg"
          ? "image/jpeg"
          : extname(path) === ".png"
            ? "image/png"
            : "image/webp",
      )
      .send(data);
  }
  private validateAvatar(file: { buffer: Buffer }): "jpg" | "png" | "webp" {
    const data = file.buffer;
    if (data.length > 200 * 1024)
      throw new BadRequestException({
        message: "Validation failed.",
        errors: { avatar: ["The avatar must be 200 KB or smaller."] },
      });
    let width = 0;
    let height = 0;
    let ext: "jpg" | "png" | "webp";
    if (
      data.length >= 24 &&
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      ext = "png";
      width = data.readUInt32BE(16);
      height = data.readUInt32BE(20);
    } else if (
      data.length >= 30 &&
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP"
    ) {
      ext = "webp";
      const kind = data.toString("ascii", 12, 16);
      if (kind === "VP8X") {
        width = 1 + data.readUIntLE(24, 3);
        height = 1 + data.readUIntLE(27, 3);
      } else if (kind === "VP8L" && data.length >= 25) {
        const bits = data.readUInt32LE(21);
        width = (bits & 0x3fff) + 1;
        height = ((bits >> 14) & 0x3fff) + 1;
      } else if (kind === "VP8 " && data.length >= 30) {
        width = data.readUInt16LE(26) & 0x3fff;
        height = data.readUInt16LE(28) & 0x3fff;
      }
    } else if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
      ext = "jpg";
      for (let i = 2; i + 9 < data.length; ) {
        if (data[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = data[i + 1];
        const size = data.readUInt16BE(i + 2);
        if (
          [
            0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
            0xce, 0xcf,
          ].includes(marker)
        ) {
          height = data.readUInt16BE(i + 5);
          width = data.readUInt16BE(i + 7);
          break;
        }
        if (size < 2) break;
        i += size + 2;
      }
    } else
      throw new BadRequestException({
        message: "Validation failed.",
        errors: { avatar: ["The avatar must be a JPG, PNG or WebP image."] },
      });
    if (width < 50 || height < 50 || width > 200 || height > 200)
      throw new BadRequestException({
        message: "Validation failed.",
        errors: {
          avatar: [
            "The avatar dimensions must be between 50×50 and 200×200 pixels.",
          ],
        },
      });
    return ext;
  }
  @Patch(":id/organization") async assignOrganization(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: AssignOrganizationDto,
  ) {
    if (
      !(await this.authorization.canAccessUser(
        req.currentUser.id,
        BigInt(id),
        "users.assign-organization",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    if (
      body.departmentId != null &&
      !(await this.authorization.canAccessDepartment(
        req.currentUser.id,
        BigInt(body.departmentId),
        false,
        "users.assign-organization",
      ))
    )
      throw new ForbiddenException("Department access denied.");
    return this.users.assignOrganization(
      BigInt(id),
      body.departmentId == null ? null : BigInt(body.departmentId),
      body.accessLevelId == null ? null : BigInt(body.accessLevelId),
      body.jobTitle ?? null,
      req.currentUser.id,
    );
  }
  @Patch(":id/approve") async approve(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    if (
      !(await this.authorization.canAccessUser(
        req.currentUser.id,
        BigInt(id),
        "users.approve",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    if (!req.authContext.companyId)
      throw new ForbiddenException("An active company is required.");
    return this.users.approve(
      BigInt(id),
      req.currentUser.id,
      BigInt(req.authContext.holdingId),
      BigInt(req.authContext.companyId),
    );
  }
  @Patch(":id/revoke") async revoke(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    if (
      !(await this.authorization.canAccessUser(
        req.currentUser.id,
        BigInt(id),
        "users.approve",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.users.revoke(BigInt(id), req.currentUser.id);
  }
  @Patch(":id/role") async setRole(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateRoleDto,
  ) {
    if (
      !(await this.authorization.canAccessUser(
        req.currentUser.id,
        BigInt(id),
        "users.assign-organization",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    return this.users.setRole(BigInt(id), body.role, req.currentUser.id);
  }
}
