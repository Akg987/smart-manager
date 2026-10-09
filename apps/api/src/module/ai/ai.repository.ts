import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  aiConversations,
  aiMessages,
  aiRecommendations,
  auditLogs,
  businessUnits,
  companies,
  type JsonValue,
} from "../../../../../src/db/schema.js";
import { BaseRepository } from "../../common/repository/base.repository.js";
import {
  DRIZZLE_DB,
  type DrizzleDatabase,
} from "../../database/database.token.js";

@Injectable()
export class AiRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDatabase) {
    super(db);
  }

  listCompanies(holdingId: bigint) {
    return this.db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.holdingId, holdingId))
      .orderBy(companies.name)
      .limit(200);
  }

  async findCompany(holdingId: bigint, companyId: bigint) {
    const [company] = await this.db
      .select({
        id: companies.id,
        name: companies.name,
        status: companies.status,
      })
      .from(companies)
      .where(
        and(eq(companies.holdingId, holdingId), eq(companies.id, companyId)),
      )
      .limit(1);
    return company ?? null;
  }

  async actionDepartments(companyId: bigint, domain?: string | null) {
    const rows = await this.db
      .select({ legacyDepartmentId: businessUnits.legacyDepartmentId })
      .from(businessUnits)
      .where(
        domain
          ? and(
              eq(businessUnits.companyId, companyId),
              eq(businessUnits.domain, domain),
              eq(businessUnits.status, "active"),
            )
          : and(
              eq(businessUnits.companyId, companyId),
              eq(businessUnits.status, "active"),
            ),
      );
    return new Set(
      rows.flatMap((row) =>
        row.legacyDepartmentId ? [row.legacyDepartmentId.toString()] : [],
      ),
    );
  }

  async listConversations(input: {
    userId: bigint;
    holdingId: bigint;
    companyId: bigint;
  }) {
    return this.db
      .select()
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.ownerUserId, input.userId),
          eq(aiConversations.holdingId, input.holdingId),
          eq(aiConversations.companyId, input.companyId),
        ),
      )
      .orderBy(desc(aiConversations.updatedAt))
      .limit(50);
  }

  async findConversation(
    id: bigint,
    userId: bigint,
    holdingId: bigint,
    companyId: bigint,
  ) {
    const [row] = await this.db
      .select()
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.id, id),
          eq(aiConversations.ownerUserId, userId),
          eq(aiConversations.holdingId, holdingId),
          eq(aiConversations.companyId, companyId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async createConversation(input: {
    userId: bigint;
    holdingId: bigint;
    companyId: bigint;
    title: string;
    model: string;
  }) {
    const [row] = await this.db
      .insert(aiConversations)
      .values({
        ownerUserId: input.userId,
        holdingId: input.holdingId,
        companyId: input.companyId,
        title: input.title.slice(0, 240),
        model: input.model.slice(0, 120),
      })
      .returning();
    return row;
  }

  async addMessage(input: {
    conversationId: bigint;
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls?: unknown;
    sourceReferences?: unknown;
    metadata?: unknown;
  }) {
    const [message] = await this.db
      .insert(aiMessages)
      .values({
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        toolCalls: (input.toolCalls ?? []) as JsonValue,
        sourceReferences: (input.sourceReferences ?? []) as JsonValue,
        metadata: (input.metadata ?? {}) as JsonValue,
      })
      .returning();
    await this.db
      .update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversations.id, input.conversationId));
    return message;
  }

  async listMessages(conversationId: bigint) {
    return this.db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(aiMessages.createdAt);
  }

  async findMessageConversation(messageId: bigint) {
    const [row] = await this.db
      .select({ conversationId: aiMessages.conversationId })
      .from(aiMessages)
      .where(eq(aiMessages.id, messageId))
      .limit(1);
    return row?.conversationId ?? null;
  }

  async addRecommendations(
    conversationId: bigint,
    messageId: bigint,
    recommendations: Array<{ key: string; details: unknown }>,
  ) {
    if (!recommendations.length) return [];
    return this.db
      .insert(aiRecommendations)
      .values(
        recommendations.map((item) => ({
          conversationId,
          messageId,
          recommendationKey: item.key,
          details: item.details as JsonValue,
        })),
      )
      .returning();
  }

  async listRecommendations(conversationId: bigint) {
    return this.db
      .select()
      .from(aiRecommendations)
      .where(eq(aiRecommendations.conversationId, conversationId))
      .orderBy(aiRecommendations.createdAt);
  }

  async recommendation(
    recommendationId: bigint,
    userId: bigint,
    holdingId: bigint,
    companyId: bigint,
  ) {
    const [row] = await this.db
      .select({
        recommendation: aiRecommendations,
        conversation: aiConversations,
      })
      .from(aiRecommendations)
      .innerJoin(
        aiConversations,
        eq(aiRecommendations.conversationId, aiConversations.id),
      )
      .where(
        and(
          eq(aiRecommendations.id, recommendationId),
          eq(aiConversations.ownerUserId, userId),
          eq(aiConversations.holdingId, holdingId),
          eq(aiConversations.companyId, companyId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async reviewRecommendation(input: {
    id: bigint;
    actorId: bigint;
    decision: "accepted" | "rejected";
    actionId?: bigint | null;
  }) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(aiRecommendations)
        .where(eq(aiRecommendations.id, input.id))
        .for("update")
        .limit(1);
      if (!current || current.status !== "pending") return null;
      const [updated] = await tx
        .update(aiRecommendations)
        .set({
          status: input.decision,
          reviewedBy: input.actorId,
          reviewedAt: new Date(),
          actionId: input.actionId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(aiRecommendations.id, input.id))
        .returning();
      return updated;
    });
  }

  async reserveRecommendation(id: bigint) {
    const [row] = await this.db
      .update(aiRecommendations)
      .set({ status: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(aiRecommendations.id, id),
          eq(aiRecommendations.status, "pending"),
        ),
      )
      .returning();
    return row ?? null;
  }

  async finishRecommendation(input: {
    id: bigint;
    actorId: bigint;
    decision: "accepted" | "rejected";
    actionId?: bigint | null;
  }) {
    const [row] = await this.db
      .update(aiRecommendations)
      .set({
        status: input.decision,
        reviewedBy: input.actorId,
        reviewedAt: new Date(),
        actionId: input.actionId ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiRecommendations.id, input.id),
          eq(aiRecommendations.status, "processing"),
        ),
      )
      .returning();
    return row ?? null;
  }

  async releaseRecommendation(id: bigint) {
    await this.db
      .update(aiRecommendations)
      .set({ status: "pending", updatedAt: new Date() })
      .where(
        and(
          eq(aiRecommendations.id, id),
          eq(aiRecommendations.status, "processing"),
        ),
      );
  }

  async writeAudit(input: {
    actorId: bigint;
    holdingId: bigint;
    companyId: bigint;
    action: string;
    subjectType: string;
    subjectId: bigint;
    description: string;
    context: unknown;
  }) {
    await this.db.insert(auditLogs).values({
      userId: input.actorId,
      holdingId: input.holdingId,
      companyId: input.companyId,
      actorName: "AI Analytics",
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      description: input.description,
      context: input.context as JsonValue,
      ipAddress: null,
      userAgent: null,
    });
  }
}
