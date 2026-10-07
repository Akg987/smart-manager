import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import type { FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { SkipResponseWrap } from "../../common/decorators/skip-response-wrap.decorator.js";
import { FastifyFileInterceptor } from "../../common/interceptors/fastify-file.interceptor.js";
import { UploadedFastifyFile } from "../../common/decorators/uploaded-fastify-file.decorator.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { SettingsService } from "./settings.service.js";
class BrandingDto {
  @IsString() @MaxLength(150) companyName!: string;
  @IsOptional() @IsString() logoPath?: string | null;
}
@Controller("settings")
@UseGuards(SessionGuard)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly authorization: AuthorizationService,
  ) {}
  @Get("branding") branding() {
    return this.settings.getBranding();
  }
  @Patch("branding") async update(
    @Req() req: AuthenticatedRequest,
    @Body() body: BrandingDto,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "settings.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    const current = await this.settings.getBranding();
    return this.settings.updateBranding(
      body.companyName,
      body.logoPath === undefined ? (current?.logoPath ?? null) : body.logoPath,
    );
  }
  @Post("branding/logo")
  @UseInterceptors(FastifyFileInterceptor("logo"))
  async uploadLogo(
    @Req() req: AuthenticatedRequest,
    @UploadedFastifyFile() file: { buffer: Buffer } | undefined,
  ) {
    if (
      !(await this.authorization.hasPermission(
        req.currentUser.id,
        "settings.manage",
      ))
    )
      throw new ForbiddenException("Permission denied.");
    if (!file || file.buffer.length === 0 || file.buffer.length > 1_048_576)
      throw new BadRequestException(
        "Logo must be a JPG, PNG or WebP image up to 1 MB.",
      );
    const ext = logoExt(file.buffer);
    const directory = join(
      resolve(process.env.UPLOAD_DIR ?? "storage/uploads"),
      "branding",
    );
    await mkdir(directory, { recursive: true });
    const name = `${randomBytes(12).toString("hex")}.${ext}`;
    await writeFile(join(directory, name), file.buffer);
    const current = await this.settings.getBranding();
    const saved = await this.settings.updateBranding(
      current?.companyName || "اسمارت منیجر",
      `branding/${name}`,
    );
    return { logoPath: saved.logoPath };
  }
  @Get("branding/logo") @SkipResponseWrap() async logo(
    @Res() reply: FastifyReply,
  ) {
    const current = await this.settings.getBranding();
    if (
      !current?.logoPath ||
      !/^branding\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(current.logoPath)
    )
      throw new NotFoundException("Logo not found.");
    const root = resolve(process.env.UPLOAD_DIR ?? "storage/uploads");
    const path = resolve(root, current.logoPath);
    const relative = path.slice(root.length).replaceAll("\\", "/");
    if (relative !== `/${current.logoPath}`)
      throw new NotFoundException("Logo not found.");
    const data = await readFile(path).catch(() => {
      throw new NotFoundException("Logo not found.");
    });
    const ext = extname(path);
    return reply
      .header("Cache-Control", "private, max-age=3600")
      .type(
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg",
      )
      .send(data);
  }
}

function logoExt(data: Buffer): "jpg" | "png" | "webp" {
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (
    data.length >= 12 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8) return "jpg";
  throw new BadRequestException(
    "Logo must be a JPG, PNG or WebP image up to 1 MB.",
  );
}
