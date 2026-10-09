import { Inject, Injectable } from "@nestjs/common";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { AlertSeverity } from "../../../../../src/db/schema.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { CorrectiveActionsRepository } from "./corrective-actions.repository.js";

@Injectable()
export class CorrectiveActionsService {
  static band(
    severity: AlertSeverity | string,
  ): "critical" | "red" | "yellow" | "other" {
    if (severity === "urgent") return "critical";
    if (severity === "high") return "red";
    if (severity === "medium") return "yellow";
    return "other";
  }

  constructor(
    @Inject(CorrectiveActionsRepository)
    private readonly repository: CorrectiveActionsRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  dashboardSnapshot(
    ...args: Parameters<CorrectiveActionsRepository["dashboardSnapshot"]>
  ) {
    return this.repository.dashboardSnapshot(...args);
  }

  weeklySnapshot(
    ...args: Parameters<CorrectiveActionsRepository["weeklySnapshot"]>
  ) {
    return this.repository.weeklySnapshot(...args);
  }

  listPriorities(
    ...args: Parameters<CorrectiveActionsRepository["listPriorities"]>
  ) {
    return this.repository.listPriorities(...args);
  }

  defaultPriority(
    ...args: Parameters<CorrectiveActionsRepository["defaultPriority"]>
  ) {
    return this.repository.defaultPriority(...args);
  }

  addPriority(...args: Parameters<CorrectiveActionsRepository["addPriority"]>) {
    return this.repository.addPriority(...args);
  }

  deletePriority(
    ...args: Parameters<CorrectiveActionsRepository["deletePriority"]>
  ) {
    return this.repository.deletePriority(...args);
  }

  renamePriority(
    ...args: Parameters<CorrectiveActionsRepository["renamePriority"]>
  ) {
    return this.repository.renamePriority(...args);
  }

  create(...args: Parameters<CorrectiveActionsRepository["create"]>) {
    return this.repository.create(...args);
  }

  updateStatus(
    ...args: Parameters<CorrectiveActionsRepository["updateStatus"]>
  ) {
    return this.repository.updateStatus(...args);
  }

  updateProgress(
    ...args: Parameters<CorrectiveActionsRepository["updateProgress"]>
  ) {
    return this.repository.updateProgress(...args);
  }

  updateAssignment(
    ...args: Parameters<CorrectiveActionsRepository["updateAssignment"]>
  ) {
    return this.repository.updateAssignment(...args);
  }

  async uploadEvidence(
    actionId: bigint,
    actorId: bigint,
    file: { buffer: Buffer; filename: string; mimetype: string } | undefined,
  ) {
    if (!file?.buffer?.length || file.buffer.length > 1_048_576)
      throw new BadRequestException(
        "Evidence file is required and must be at most 1 MB.",
      );
    const detected = detectEvidenceType(file.buffer);
    if (!detected || detected.mime !== file.mimetype)
      throw new BadRequestException("Unsupported evidence file.");
    const allowed =
      (await this.authorization.canAccessAction(
        actorId,
        actionId,
        "actions.update-own",
      )) ||
      (await this.authorization.canAccessAction(
        actorId,
        actionId,
        "actions.manage",
      ));
    if (!allowed) throw new ForbiddenException("Permission denied.");
    const root = resolve(process.env.UPLOAD_DIR ?? "storage/uploads");
    const directory = join(root, "actions", actionId.toString());
    await mkdir(directory, { recursive: true });
    const storageKey = `actions/${actionId}/${randomUUID()}.${detected.extension}`;
    const absolutePath = join(root, storageKey);
    const originalFileName =
      basename(file.filename)
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .slice(0, 255) || "evidence";
    await writeFile(absolutePath, file.buffer, { flag: "wx" });
    try {
      return await this.repository.addEvidenceMetadata({
        actionId,
        actorId,
        storageKey,
        originalFileName,
        mimeType: detected.mime,
        fileSize: file.buffer.length,
      });
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  }

  async readEvidence(actionId: bigint, evidenceId: bigint, actorId: bigint) {
    if (
      !(await this.authorization.canAccessAction(
        actorId,
        actionId,
        "actions.view",
      ))
    )
      throw new NotFoundException("Evidence not found.");
    const [evidence] = await this.repository.findEvidence(actionId, evidenceId);
    if (
      !evidence ||
      !/^actions\/\d+\/[a-f0-9-]+\.(pdf|png|jpg|webp)$/.test(
        evidence.storageKey,
      )
    )
      throw new NotFoundException("Evidence not found.");
    const root = resolve(process.env.UPLOAD_DIR ?? "storage/uploads");
    const absolutePath = resolve(root, evidence.storageKey);
    if (
      !absolutePath.startsWith(root + "\\") &&
      !absolutePath.startsWith(root + "/")
    )
      throw new NotFoundException("Evidence not found.");
    const buffer = await readFile(absolutePath).catch(() => {
      throw new NotFoundException("Evidence not found.");
    });
    return { evidence, buffer };
  }

  acknowledgeAlert(
    ...args: Parameters<CorrectiveActionsRepository["acknowledgeAlert"]>
  ) {
    return this.repository.acknowledgeAlert(...args);
  }

  resolveAlert(
    ...args: Parameters<CorrectiveActionsRepository["resolveAlert"]>
  ) {
    return this.repository.resolveAlert(...args);
  }

  alertBoard(...args: Parameters<CorrectiveActionsRepository["alertBoard"]>) {
    return this.repository.alertBoard(...args);
  }

  actionBoard(...args: Parameters<CorrectiveActionsRepository["actionBoard"]>) {
    return this.repository.actionBoard(...args);
  }
}

function detectEvidenceType(buffer: Buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { mime: "image/png", extension: "png" };
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return { mime: "image/jpeg", extension: "jpg" };
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return { mime: "image/webp", extension: "webp" };
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-")
    return { mime: "application/pdf", extension: "pdf" };
  return null;
}
