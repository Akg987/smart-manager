import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { AiService } from "./ai.service.js";

function serviceWithContext(
  context: unknown,
  allow = false,
  repo: Record<string, unknown> = {},
) {
  const authorization = {
    currentContext: () => context,
    can: async () => allow,
  };
  return new AiService(
    repo as never,
    authorization as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

const companyContext = {
  userId: "1",
  holdingId: "1",
  membershipId: "1",
  companyId: "10",
  branchId: null,
  businessUnitId: null,
  roleIds: [],
  scopeType: "company",
};

function recommendationService(
  options: {
    permissions?: string[];
    found?: unknown;
    actionCreate?: (...args: unknown[]) => Promise<unknown>;
    finish?: (...args: unknown[]) => Promise<unknown>;
  } = {},
) {
  const permissions = new Set(
    options.permissions ?? ["ai.chat", "ai.recommendations", "action.create"],
  );
  const events: Array<{ type: string; value?: unknown }> = [];
  const repository = {
    recommendation: async (...args: unknown[]) => {
      events.push({ type: "lookup", value: args });
      return (
        options.found ?? {
          conversation: { id: 20n },
          recommendation: {
            id: 30n,
            details: {
              title: "Improve conversion",
              description: "Follow up with qualified leads.",
              successMetric: "Conversion rate",
              sourceIds: ["kpi:conversion"],
            },
          },
        }
      );
    },
    actionDepartments: async () => new Set(["40"]),
    reserveRecommendation: async (id: bigint) => {
      events.push({ type: "reserve", value: id });
      return { id };
    },
    finishRecommendation: async (input: {
      decision: "accepted" | "rejected";
    }) => {
      events.push({ type: "finish", value: input });
      return options.finish
        ? options.finish(input)
        : { status: input.decision };
    },
    releaseRecommendation: async (id: bigint) => {
      events.push({ type: "release", value: id });
    },
    writeAudit: async (input: unknown) => {
      events.push({ type: "audit", value: input });
    },
  };
  const action = {
    defaultPriority: async () => "high",
    create: async (input: unknown) => {
      events.push({ type: "create-action", value: input });
      return options.actionCreate
        ? options.actionCreate(input as never)
        : { id: 50n };
    },
  };
  const authorization = {
    currentContext: () => companyContext,
    can: async (_context: unknown, permission: string, resource: unknown) => {
      events.push({ type: `can:${permission}`, value: resource });
      return permissions.has(permission);
    },
  };
  const service = new AiService(
    repository as never,
    authorization as never,
    {} as never,
    {} as never,
    action as never,
    {} as never,
    {} as never,
  );
  return { service, events };
}

test("AI context fails closed when the user has no active tenant context", async () => {
  const service = serviceWithContext(null);
  await assert.rejects(service.context(1n), ForbiddenException);
});

test("AI chat is denied before company lookup when ai.chat is missing", async () => {
  const service = serviceWithContext({
    userId: "1",
    holdingId: "1",
    membershipId: "1",
    companyId: "10",
    branchId: null,
    businessUnitId: null,
    roleIds: [],
    scopeType: "company",
  });
  await assert.rejects(
    service.chat(1n, { question: "summarize" }),
    ForbiddenException,
  );
});

test("AI chat rejects a company outside the active membership before lookup", async () => {
  const service = serviceWithContext(
    {
      userId: "1",
      holdingId: "1",
      membershipId: "1",
      companyId: "10",
      branchId: null,
      businessUnitId: null,
      roleIds: [],
      scopeType: "company",
    },
    true,
  );
  await assert.rejects(
    service.chat(1n, { question: "summarize", companyId: 20 }),
    ForbiddenException,
  );
});

test("AI analysis requires both the transfer switch and scoped permission", async () => {
  const original = process.env.AI_EXTERNAL_DATA_TRANSFER_APPROVED;
  process.env.AI_EXTERNAL_DATA_TRANSFER_APPROVED = "true";
  const service = serviceWithContext(
    {
      userId: "1",
      holdingId: "1",
      membershipId: "1",
      companyId: "10",
      branchId: null,
      businessUnitId: null,
      roleIds: [],
      scopeType: "company",
    },
    true,
    {
      findCompany: async () => ({ id: 10n, name: "Test Co", status: "active" }),
    },
  );
  try {
    const context = await service.context(1n);
    assert.equal(context.canAnalyze, true);
    assert.equal(context.analysisPaused, false);
  } finally {
    if (original === undefined)
      delete process.env.AI_EXTERNAL_DATA_TRANSFER_APPROVED;
    else process.env.AI_EXTERNAL_DATA_TRANSFER_APPROVED = original;
  }
});

test("external AI data transfer remains blocked until provider and data scope approval", async () => {
  const original = {
    url: process.env.AI_API_BASE_URL,
    key: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    transferApproved: process.env.AI_EXTERNAL_DATA_TRANSFER_APPROVED,
  };
  process.env.AI_EXTERNAL_DATA_TRANSFER_APPROVED = "false";
  delete process.env.AI_API_BASE_URL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  const service = serviceWithContext(
    {
      userId: "1",
      holdingId: "1",
      membershipId: "1",
      companyId: "10",
      branchId: null,
      businessUnitId: null,
      roleIds: [],
      scopeType: "company",
    },
    true,
    {
      findCompany: async () => ({ id: 10n, name: "Test Co", status: "active" }),
    },
  );
  try {
    await assert.rejects(
      service.chat(1n, { question: "summarize", companyId: 10 }),
      /External AI analysis is paused/,
    );
  } finally {
    if (original.url === undefined) delete process.env.AI_API_BASE_URL;
    else process.env.AI_API_BASE_URL = original.url;
    if (original.key === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = original.key;
    if (original.model === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = original.model;
    if (original.transferApproved === undefined)
      delete process.env.AI_EXTERNAL_DATA_TRANSFER_APPROVED;
    else
      process.env.AI_EXTERNAL_DATA_TRANSFER_APPROVED =
        original.transferApproved;
  }
});

test("AI recommendation review is denied without its scoped permission", async () => {
  const { service, events } = recommendationService({
    permissions: ["ai.chat", "action.create"],
  });
  await assert.rejects(
    service.reviewRecommendation(1n, 20n, 30n, { decision: "rejected" }),
    ForbiddenException,
  );
  assert.equal(
    events.some((event) => event.type === "lookup"),
    false,
  );
  assert.equal(
    events.some((event) => event.type === "reserve"),
    false,
  );
});

test("recommendation from another conversation cannot be reviewed", async () => {
  const { service, events } = recommendationService({
    found: {
      conversation: { id: 21n },
      recommendation: { id: 30n, details: {} },
    },
  });
  await assert.rejects(
    service.reviewRecommendation(1n, 20n, 30n, { decision: "rejected" }),
    ForbiddenException,
  );
  assert.equal(
    events.some((event) => event.type === "reserve"),
    false,
  );
});

test("authorized rejection reserves, audits, and does not create an action", async () => {
  const { service, events } = recommendationService();
  const result = await service.reviewRecommendation(1n, 20n, 30n, {
    decision: "rejected",
    reason: "Insufficient evidence",
  });
  assert.deepEqual(result, { status: "rejected" });
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "can:ai.chat",
      "can:ai.recommendations",
      "lookup",
      "reserve",
      "finish",
      "audit",
    ],
  );
  assert.equal(
    events.some((event) => event.type === "create-action"),
    false,
  );
  assert.equal(
    (events.at(-1)?.value as { action: string }).action,
    "ai.recommendation.rejected",
  );
});

test("accepted recommendation creates a scoped action and records the link and audit", async () => {
  const { service, events } = recommendationService();
  const result = await service.reviewRecommendation(1n, 20n, 30n, {
    decision: "accepted",
    departmentId: 40,
    ownerUserId: 41,
    approverUserId: 42,
    dueAt: "1405/08/20",
  });
  assert.equal(
    (result as unknown as { action: { id: string } }).action.id,
    "50",
  );
  const createEvent = events.find((event) => event.type === "create-action");
  assert.ok(createEvent);
  assert.deepEqual(createEvent.value, {
    departmentId: 40n,
    title: "Improve conversion",
    description:
      "Follow up with qualified leads.\n\nAI evidence: kpi:conversion",
    successMetric: "Conversion rate",
    ownerUserId: 41n,
    approverUserId: 42n,
    createdBy: 1n,
    priority: "high",
    dueAt: "1405/08/20",
  });
  const finishEvent = events.find((event) => event.type === "finish");
  assert.deepEqual(finishEvent?.value, {
    id: 30n,
    actorId: 1n,
    decision: "accepted",
    actionId: 50n,
  });
  assert.equal(
    (events.at(-1)?.value as { action: string }).action,
    "ai.recommendation.accepted",
  );
});

test("accepted recommendation requires action.create permission", async () => {
  const { service, events } = recommendationService({
    permissions: ["ai.chat", "ai.recommendations"],
  });
  await assert.rejects(
    service.reviewRecommendation(1n, 20n, 30n, {
      decision: "accepted",
      departmentId: 40,
      ownerUserId: 41,
      approverUserId: 42,
      dueAt: "1405/08/20",
    }),
    ForbiddenException,
  );
  assert.equal(
    events.some((event) => event.type === "reserve"),
    false,
  );
  assert.equal(
    events.some((event) => event.type === "create-action"),
    false,
  );
});

test("recommendation acceptance releases its reservation when action creation fails", async () => {
  const failure = new Error("Action validation failed.");
  const { service, events } = recommendationService({
    actionCreate: async () => {
      throw failure;
    },
  });
  await assert.rejects(
    service.reviewRecommendation(1n, 20n, 30n, {
      decision: "accepted",
      departmentId: 40,
      ownerUserId: 41,
      approverUserId: 42,
      dueAt: "1405/08/20",
    }),
    failure,
  );
  assert.equal(events.at(-1)?.type, "release");
});
