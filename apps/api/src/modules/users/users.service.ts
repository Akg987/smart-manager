import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { jalaliDateToGregorian } from "../../shared/jalali.js";
import { UsersRepository } from "./users.repository.js";

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async approve(userId: bigint, approverId: bigint) {
    const [user] = await this.users.updateById(userId, {
      approvedAt: new Date(),
      approvedBy: approverId,
      updatedAt: new Date(),
    });
    if (!user) throw new NotFoundException("User not found.");
    return user;
  }

  async revoke(userId: bigint, actorId: bigint) {
    if (userId === actorId)
      throw new BadRequestException("You cannot revoke your own access.");
    const [user] = await this.users.updateById(userId, {
      approvedAt: null,
      approvedBy: null,
      updatedAt: new Date(),
    });
    if (!user) throw new NotFoundException("User not found.");
    return user;
  }

  async setRole(userId: bigint, role: "admin" | "user", actorId: bigint) {
    if (userId === actorId)
      throw new BadRequestException("You cannot change your own role.");
    const [user] = await this.users.updateById(userId, {
      role,
      updatedAt: new Date(),
    });
    if (!user) throw new NotFoundException("User not found.");
    return user;
  }

  async departmentName(departmentId: bigint | null) {
    if (!departmentId) return null;
    const [department] = await this.users.findDepartmentName(departmentId);
    return department?.name ?? null;
  }

  async updateProfile(
    userId: bigint,
    input: {
      firstName?: string;
      lastName?: string;
      birthDate?: string | null;
      nationalCode?: string | null;
      address?: string | null;
      jobTitle?: string | null;
    },
    actorId = userId,
  ) {
    const birthText = input.birthDate?.trim() ?? "";
    const birthDate = birthText ? jalaliDateToGregorian(birthText) : null;
    if (birthText && !birthDate)
      throw new BadRequestException("Invalid Jalali birth date.");
    try {
      return await this.users.runTransaction(async (tx) => {
        const [user] = await tx
          .update(this.users.users)
          .set({
            firstName: input.firstName?.trim() || null,
            lastName: input.lastName?.trim() || null,
            nationalCode: input.nationalCode?.trim() || null,
            birthDate,
            address: input.address?.trim() || null,
            updatedAt: new Date(),
          })
          .where(this.users.eq(this.users.users.id, userId))
          .returning();
        if (!user) throw new NotFoundException("User not found.");
        await tx.insert(this.users.auditLogs).values({
          userId: actorId,
          actorName: "System",
          action: "user.profile.updated",
          subjectType: "User",
          subjectId: userId,
          description: "Profile updated",
          context: null,
          ipAddress: null,
          userAgent: null,
        });
        const { password, rememberToken, ...safe } = user;
        return {
          ...safe,
          id: safe.id.toString(),
          departmentId: safe.departmentId?.toString() ?? null,
          accessLevelId: safe.accessLevelId?.toString() ?? null,
          approvedBy: safe.approvedBy?.toString() ?? null,
        };
      });
    } catch (error) {
      const code =
        (error as { code?: string; cause?: { code?: string } }).code ??
        (error as { cause?: { code?: string } }).cause?.code;
      if (code === "23505")
        throw new BadRequestException("This national code is already in use.");
      throw error;
    }
  }

  async assignOrganization(
    userId: bigint,
    departmentId: bigint | null,
    accessLevelId: bigint | null,
    jobTitle: string | null,
    actorId: bigint,
  ) {
    return this.users.runTransaction(async (tx) => {
      const [user] = await tx
        .update(this.users.users)
        .set({ departmentId, accessLevelId, jobTitle, updatedAt: new Date() })
        .where(this.users.eq(this.users.users.id, userId))
        .returning();
      if (!user) throw new NotFoundException("User not found.");
      await tx.insert(this.users.auditLogs).values({
        userId: actorId,
        actorName: "System",
        action: "user.organization.updated",
        subjectType: "User",
        subjectId: userId,
        description: "Organization assignment updated",
        context: null,
        ipAddress: null,
        userAgent: null,
      });
      return user;
    });
  }

  async setPassword(userId: bigint, passwordHash: string, actorId = userId) {
    return this.users.runTransaction(async (tx) => {
      const [user] = await tx
        .update(this.users.users)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(this.users.eq(this.users.users.id, userId))
        .returning();
      if (!user) throw new NotFoundException("User not found.");
      await tx.insert(this.users.auditLogs).values({
        userId: actorId,
        actorName: "System",
        action: "user.password.changed",
        subjectType: "User",
        subjectId: userId,
        description: "Password changed",
        context: null,
        ipAddress: null,
        userAgent: null,
      });
      return user;
    });
  }

  async setAvatar(userId: bigint, avatarPath: string | null, actorId = userId) {
    return this.users.runTransaction(async (tx) => {
      const [user] = await tx
        .update(this.users.users)
        .set({ avatarPath, updatedAt: new Date() })
        .where(this.users.eq(this.users.users.id, userId))
        .returning();
      if (!user) throw new NotFoundException("User not found.");
      await tx.insert(this.users.auditLogs).values({
        userId: actorId,
        actorName: "System",
        action: "user.avatar.updated",
        subjectType: "User",
        subjectId: userId,
        description: "Profile avatar updated",
        context: null,
        ipAddress: null,
        userAgent: null,
      });
      return user;
    });
  }

  async findById(userId: bigint) {
    return this.users.findById(userId);
  }
}
