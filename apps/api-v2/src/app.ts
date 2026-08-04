import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { ZodError, z } from "zod";
import {
  actualRunCostInputSchema,
  approvalDecisionInputSchema,
  approvalStatusSchema,
  artifactCandidateSchema,
  budgetVarianceInputSchema,
  cashflowForecastInputSchema,
  currencyConversionInputSchema,
  financeAccountInputSchema,
  financeAllocationInputSchema,
  financeBudgetInputSchema,
  financeCategoryInputSchema,
  financeChangeProposalDecisionSchema,
  financeChangeProposalInputSchema,
  financeMonthSchema,
  financeRefundInputSchema,
  financeTransferInputSchema,
  financeTransactionInputSchema,
  knowledgeCreateInputSchema,
  knowledgeEntityTypeSchema,
  operatingEntryInputSchema,
  operatingUnitInputSchema,
  projectInputSchema,
  runCreateInputSchema,
  runInputResponseSchema,
  runReviewInputSchema,
  runtimeApprovalRequestSchema,
  runtimeEventInputSchema,
  runtimeResultInputSchema,
  scheduleRebindInputSchema,
  scheduleInputSchema,
  scheduleUpdateInputSchema,
  skillDraftInputSchema,
  skillPublishInputSchema,
  vaultInputSchema,
  workSpecInputSchema,
  workSpecRevisionInputSchema,
  type RunEvent,
  type RuntimeCapabilityScope
} from "@personal-os/vnext-contracts";
import type { FinanceService, KnowledgeService, PersonalOsService, RuntimeCapabilityGrant, ScheduleService, SkillRegistry, VNextStore } from "@personal-os/vnext-application";

export interface ApiDependencies {
  store: VNextStore;
  execution: PersonalOsService;
  schedules: ScheduleService;
  knowledge: KnowledgeService;
  finance: FinanceService;
  skills?: SkillRegistry;
  schedulerEnabled?: boolean;
}

type Variables = { requestId: string };

export function createVNextApp(dependencies: ApiDependencies): Hono<{ Variables: Variables }> {
  const { store, execution, schedules, knowledge, finance } = dependencies;
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (context, next) => {
    const requestId = context.req.header("x-request-id")?.slice(0, 200) || randomUUID();
    context.set("requestId", requestId);
    context.header("x-request-id", requestId);
    await next();
  });
  app.use("/api/v2/*", cors({ origin: ["http://localhost:5373", "http://127.0.0.1:5373", "http://localhost:5273", "http://127.0.0.1:5273"] }));

  app.onError((error, context) => {
    const requestId = context.get("requestId") ?? randomUUID();
    if (error instanceof ZodError) return context.json(failure("VALIDATION_ERROR", "请求参数不合法。", requestId, error.issues), 400);
    const code = error instanceof Error ? error.message.split(":")[0] ?? "INTERNAL_ERROR" : "INTERNAL_ERROR";
    const status = statusFor(code);
    return context.json(failure(code, friendlyMessage(error), requestId), status);
  });

  app.get("/api/v2/health", async (context) => context.json(success({
    status: "healthy",
    version: "0.1.0",
    database: "connected",
    scheduler: { ...schedules.health(), serviceEnabled: dependencies.schedulerEnabled ?? false },
    knowledge: knowledge.health(),
    pendingApprovals: store.listApprovals("pending").length,
    agentGateway: { protocol: "mcp-stdio", activeCapabilities: execution.getCapabilityAuthority().activeCount(), tools: 7 },
    skills: { available: dependencies.skills?.list().length ?? 0 },
    executors: await execution.getExecutorHealth()
  }, context.get("requestId"))));

  app.get("/api/v2/projects", (context) => context.json(success(store.listProjects(), context.get("requestId"))));
  app.post("/api/v2/projects", async (context) => context.json(success(execution.createProject(projectInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/search", (context) => context.json(success(execution.searchControlPlane(
    z.string().trim().min(1).max(200).parse(context.req.query("q")),
    numberQuery(context.req.query("limit"), 30, 1, 100)
  ), context.get("requestId"))));

  app.get("/api/v2/work-specs", (context) => context.json(success(store.listWorkSpecs({
    ...(context.req.query("projectId") ? { projectId: context.req.query("projectId") } : {}),
    ...(context.req.query("kind") === "workflow" || context.req.query("kind") === "one_off" ? { kind: context.req.query("kind") as "workflow" | "one_off" } : {})
  }), context.get("requestId"))));
  app.post("/api/v2/work-specs", async (context) => context.json(success(execution.createWorkSpec(workSpecInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/work-specs/:id/revisions", async (context) => context.json(success(execution.createWorkSpecRevision(context.req.param("id"), workSpecRevisionInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/work-specs/:id/preflight", async (context) => context.json(success(await execution.preflightWorkSpec(context.req.param("id")), context.get("requestId"))));
  app.get("/api/v2/operations/workflows", (context) => context.json(success(execution.listWorkflowOperations(), context.get("requestId"))));
  app.post("/api/v2/work-specs/:id/retire", (context) => context.json(success(execution.retireWorkSpec(context.req.param("id"), context.get("requestId")), context.get("requestId"))));
  app.get("/api/v2/skills", (context) => context.json(success(dependencies.skills?.list() ?? [], context.get("requestId"))));
  app.post("/api/v2/skills/validate", async (context) => context.json(success(execution.validateSkillDraft(skillDraftInputSchema.parse(await context.req.json())), context.get("requestId"))));
  app.post("/api/v2/skills/publish", async (context) => context.json(success(execution.publishSkill(skillPublishInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));

  app.get("/api/v2/runtime/mcp/context", (context) => {
    const grant = runtimeGrant(context.req.header("authorization"), "context:read", execution);
    return context.json(success(execution.getRuntimeContext(grant), context.get("requestId")));
  });
  app.post("/api/v2/runtime/mcp/events", async (context) => {
    const grant = runtimeGrant(context.req.header("authorization"), "event:append", execution);
    const input = runtimeEventInputSchema.parse(await context.req.json());
    return context.json(success(execution.appendRuntimeEvent(grant, { ...input, source: `runtime:${grant.executorType}` }, context.get("requestId")), context.get("requestId")), 201);
  });
  app.get("/api/v2/runtime/mcp/knowledge/search", (context) => {
    runtimeGrant(context.req.header("authorization"), "knowledge:search", execution);
    const query = z.string().trim().min(1).max(200).parse(context.req.query("q"));
    return context.json(success(store.searchKnowledge(query, numberQuery(context.req.query("limit"), 10, 1, 20)), context.get("requestId")));
  });
  app.post("/api/v2/runtime/mcp/artifacts", async (context) => {
    const grant = runtimeGrant(context.req.header("authorization"), "artifact:create", execution);
    const candidate = artifactCandidateSchema.parse(await context.req.json());
    return context.json(success(execution.createRuntimeArtifact(grant, candidate, context.get("requestId")), context.get("requestId")), 201);
  });
  app.post("/api/v2/runtime/mcp/approvals", async (context) => {
    const grant = runtimeGrant(context.req.header("authorization"), "approval:request", execution);
    const input = runtimeApprovalRequestSchema.parse(await context.req.json());
    return context.json(success(execution.requestRuntimeApproval(grant, input, context.get("requestId")), context.get("requestId")), 201);
  });
  app.get("/api/v2/runtime/mcp/approvals/current", (context) => {
    const grant = runtimeGrant(context.req.header("authorization"), "approval:read", execution);
    return context.json(success(execution.getRuntimeApproval(grant), context.get("requestId")));
  });
  app.post("/api/v2/runtime/mcp/result", async (context) => {
    const grant = runtimeGrant(context.req.header("authorization"), "result:submit", execution);
    const input = runtimeResultInputSchema.parse(await context.req.json());
    return context.json(success(execution.submitRuntimeResult(grant, input, context.get("requestId")), context.get("requestId")), 202);
  });

  app.get("/api/v2/runs", (context) => context.json(success(store.listRuns(numberQuery(context.req.query("limit"), 100, 1, 500)), context.get("requestId"))));
  app.get("/api/v2/runs/:id", (context) => {
    const run = store.getRun(context.req.param("id"));
    if (!run) throw new Error("RUN_NOT_FOUND");
    return context.json(success(run, context.get("requestId")));
  });
  app.get("/api/v2/runs/:id/events", (context) => context.json(success(store.listRunEvents(context.req.param("id"), numberQuery(context.req.query("after"), 0, 0, Number.MAX_SAFE_INTEGER)), context.get("requestId"))));
  app.post("/api/v2/work-specs/:id/runs", async (context) => {
    const input = runCreateInputSchema.parse(await optionalJson(context));
    const run = execution.createRun(context.req.param("id"), { input: input.input, idempotencyKey: input.idempotencyKey, requestId: context.get("requestId") });
    if (input.start) void execution.startRun(run.id, context.get("requestId"));
    return context.json(success(run, context.get("requestId")), 202);
  });
  app.post("/api/v2/runs/:id/start", (context) => {
    const run = store.getRun(context.req.param("id"));
    if (!run) throw new Error("RUN_NOT_FOUND");
    void execution.startRun(run.id, context.get("requestId"));
    return context.json(success(run, context.get("requestId")), 202);
  });
  app.post("/api/v2/runs/:id/cancel", (context) => context.json(success(execution.cancelRun(context.req.param("id"), context.get("requestId")), context.get("requestId"))));
  app.post("/api/v2/runs/:id/retry", (context) => {
    const run = execution.retryRun(context.req.param("id"), context.get("requestId"));
    void execution.startRun(run.id, context.get("requestId"));
    return context.json(success(run, context.get("requestId")), 202);
  });
  app.post("/api/v2/runs/:id/input", async (context) => context.json(success(
    execution.submitRunInput(context.req.param("id"), runInputResponseSchema.parse(await context.req.json()), context.get("requestId")),
    context.get("requestId")
  ), 202));
  app.post("/api/v2/runs/:id/accept", async (context) => context.json(success(
    execution.acceptRun(context.req.param("id"), runReviewInputSchema.parse(await optionalJson(context)), context.get("requestId")),
    context.get("requestId")
  )));
  app.post("/api/v2/runs/:id/reject", async (context) => context.json(success(
    execution.rejectRun(context.req.param("id"), runReviewInputSchema.parse(await optionalJson(context)), context.get("requestId")),
    context.get("requestId")
  )));
  app.post("/api/v2/runs/:id/cost", async (context) => context.json(success(
    execution.recordActualCost(context.req.param("id"), actualRunCostInputSchema.parse(await context.req.json()), context.get("requestId")),
    context.get("requestId")
  )));
  app.get("/api/v2/runs/:id/artifacts", (context) => {
    if (!store.getRun(context.req.param("id"))) throw new Error("RUN_NOT_FOUND");
    return context.json(success(store.listArtifactsForRun(context.req.param("id")), context.get("requestId")));
  });
  app.get("/api/v2/runs/:id/events/stream", (context) => streamSSE(context, async (stream) => {
    const runId = context.req.param("id");
    if (!store.getRun(runId)) throw new Error("RUN_NOT_FOUND");
    const after = numberQuery(context.req.query("after"), 0, 0, Number.MAX_SAFE_INTEGER);
    const send = async (event: RunEvent) => stream.writeSSE({ id: String(event.sequence), event: event.eventType, data: JSON.stringify(event) });
    if (context.req.query("once") === "1") {
      for (const event of store.listRunEvents(runId, after)) await send(event);
      return;
    }

    let lastSequence = after;
    let replaying = true;
    let closed = false;
    const buffered: RunEvent[] = [];
    let resolveClosed: () => void = () => undefined;
    const closedPromise = new Promise<void>((resolvePromise) => { resolveClosed = resolvePromise; });
    let unsubscribe: () => void = () => undefined;
    const heartbeat = setInterval(() => { void stream.writeSSE({ event: "heartbeat", data: "{}" }); }, 15_000);
    const close = () => {
      if (closed) return;
      closed = true;
      unsubscribe();
      clearInterval(heartbeat);
      resolveClosed();
    };
    const deliver = async (event: RunEvent) => {
      if (closed || event.sequence <= lastSequence) return;
      await send(event);
      lastSequence = event.sequence;
      if (isTerminalEvent(event.eventType)) close();
    };
    let deliveryQueue = Promise.resolve();
    const enqueue = (event: RunEvent) => {
      deliveryQueue = deliveryQueue.then(() => deliver(event)).catch(close);
    };
    unsubscribe = execution.subscribe(runId, (event) => {
      if (replaying) buffered.push(event);
      else enqueue(event);
    });
    context.req.raw.signal.addEventListener("abort", close, { once: true });

    for (const event of store.listRunEvents(runId, after)) await deliver(event);
    replaying = false;
    for (const event of buffered.sort((left, right) => left.sequence - right.sequence)) await deliver(event);
    await deliveryQueue;
    if (isTerminal(store.getRun(runId)?.status)) close();
    await closedPromise;
  }));

  app.get("/api/v2/schedules", (context) => context.json(success(store.listSchedules(), context.get("requestId"))));
  app.post("/api/v2/schedules", async (context) => context.json(success(schedules.create(scheduleInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.patch("/api/v2/schedules/:id", async (context) => context.json(success(schedules.update(context.req.param("id"), scheduleUpdateInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId"))));
  app.post("/api/v2/schedules/:id/rebind", async (context) => {
    const input = scheduleRebindInputSchema.parse(await context.req.json());
    const preflight = await execution.preflightWorkSpec(input.workSpecId);
    if (!preflight.ready) throw new Error("WORK_SPEC_PREFLIGHT_FAILED");
    return context.json(success(schedules.rebind(context.req.param("id"), input, context.get("requestId")), context.get("requestId")));
  });
  app.post("/api/v2/schedules/:id/pause", (context) => context.json(success(schedules.setEnabled(context.req.param("id"), false, context.get("requestId")), context.get("requestId"))));
  app.post("/api/v2/schedules/:id/resume", (context) => context.json(success(schedules.setEnabled(context.req.param("id"), true, context.get("requestId")), context.get("requestId"))));
  app.post("/api/v2/schedules/:id/run-now", (context) => context.json(success(schedules.runNow(context.req.param("id"), context.get("requestId")), context.get("requestId")), 202));

  app.get("/api/v2/approvals", (context) => {
    const raw = context.req.query("status");
    const status = raw ? approvalStatusSchema.parse(raw) : undefined;
    return context.json(success(store.listApprovals(status), context.get("requestId")));
  });
  app.post("/api/v2/approvals/:id/resolve", async (context) => context.json(success(
    execution.resolveApproval(context.req.param("id"), approvalDecisionInputSchema.parse(await context.req.json()), context.get("requestId")),
    context.get("requestId")
  ), 202));

  app.get("/api/v2/knowledge/vaults", (context) => context.json(success(store.listVaults(), context.get("requestId"))));
  app.post("/api/v2/knowledge/vaults", async (context) => context.json(success(knowledge.addVault(vaultInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/knowledge/vaults/:id/index", (context) => context.json(success(knowledge.indexVault(context.req.param("id")), context.get("requestId"))));
  app.get("/api/v2/knowledge/health", (context) => context.json(success(knowledge.health(), context.get("requestId"))));
  app.get("/api/v2/knowledge/search", (context) => {
    const entityType = context.req.query("entityType");
    return context.json(success(store.searchKnowledge(
      context.req.query("q") ?? "",
      numberQuery(context.req.query("limit"), 30, 1, 100),
      {
        ...(context.req.query("tag") ? { tag: context.req.query("tag") } : {}),
        ...(entityType ? { entityType: knowledgeEntityTypeSchema.parse(entityType) } : {}),
        ...(context.req.query("entityId") ? { entityId: context.req.query("entityId") } : {})
      }
    ), context.get("requestId")));
  });
  app.get("/api/v2/knowledge/documents/:id", (context) => context.json(success(knowledge.getDocument(context.req.param("id")), context.get("requestId"))));
  app.post("/api/v2/knowledge/documents", async (context) => context.json(success(knowledge.createDocument(knowledgeCreateInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/knowledge/links", (context) => {
    const entityType = knowledgeEntityTypeSchema.parse(context.req.query("entityType"));
    const entityId = z.string().min(1).max(200).parse(context.req.query("entityId"));
    return context.json(success(store.listKnowledgeLinksForEntity(entityType, entityId), context.get("requestId")));
  });

  app.get("/api/v2/finance/accounts", (context) => context.json(success(finance.listAccounts(), context.get("requestId"))));
  app.post("/api/v2/finance/accounts", async (context) => context.json(success(finance.createAccount(financeAccountInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/finance/transactions", (context) => context.json(success(finance.listTransactions(), context.get("requestId"))));
  app.post("/api/v2/finance/transactions", async (context) => context.json(success(finance.createTransaction(financeTransactionInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/finance/transfers", async (context) => context.json(success(finance.createTransfer(financeTransferInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/finance/refunds", async (context) => context.json(success(finance.createRefund(financeRefundInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/finance/summary/monthly", (context) => {
    const month = financeMonthSchema.parse(context.req.query("month"));
    const currency = z.string().length(3).transform((value) => value.toUpperCase()).parse(context.req.query("currency") ?? "CNY");
    return context.json(success(finance.monthlySummary(month, currency), context.get("requestId")));
  });
  app.get("/api/v2/finance/categories", (context) => context.json(success(finance.listCategories(), context.get("requestId"))));
  app.post("/api/v2/finance/categories", async (context) => context.json(success(finance.createCategory(financeCategoryInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/finance/budgets", (context) => context.json(success(finance.listBudgets(context.req.query("month"), context.req.query("currency")?.toUpperCase()), context.get("requestId"))));
  app.post("/api/v2/finance/budgets", async (context) => context.json(success(finance.setBudget(financeBudgetInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/finance/calculations", (context) => context.json(success(finance.listCalculations(), context.get("requestId"))));
  app.post("/api/v2/finance/calculations/budget-variance", async (context) => context.json(success(finance.calculateBudgetVariance(budgetVarianceInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/finance/calculations/cashflow", async (context) => context.json(success(finance.calculateCashflow(cashflowForecastInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/finance/calculations/conversion", async (context) => context.json(success(finance.calculateConversion(currencyConversionInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/finance/calculations/:id/replay", (context) => context.json(success(finance.replayCalculation(context.req.param("id")), context.get("requestId"))));
  app.get("/api/v2/finance/operating-units", (context) => context.json(success(finance.listOperatingUnits(), context.get("requestId"))));
  app.post("/api/v2/finance/operating-units", async (context) => context.json(success(finance.createOperatingUnit(operatingUnitInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/finance/allocations", (context) => context.json(success(finance.listAllocations(context.req.query("operatingUnitId")), context.get("requestId"))));
  app.post("/api/v2/finance/allocations", async (context) => context.json(success(finance.allocate(financeAllocationInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/finance/operating-entries", (context) => context.json(success(finance.listOperatingEntries(context.req.query("operatingUnitId")), context.get("requestId"))));
  app.post("/api/v2/finance/operating-entries", async (context) => context.json(success(finance.createOperatingEntry(operatingEntryInputSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId")), 201));
  app.get("/api/v2/finance/operating-units/:id/summary", (context) => context.json(success(finance.operatingSummary(context.req.param("id")), context.get("requestId"))));
  app.get("/api/v2/finance/change-proposals", (context) => {
    const raw = context.req.query("status");
    const status = raw ? z.enum(["pending", "approved", "rejected"]).parse(raw) : undefined;
    return context.json(success(finance.listChangeProposals(status), context.get("requestId")));
  });
  app.post("/api/v2/finance/change-proposals", async (context) => context.json(success(finance.createChangeProposal(financeChangeProposalInputSchema.parse(await context.req.json()), "user", context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/runtime/finance/change-proposals", async (context) => context.json(success(finance.createChangeProposal(financeChangeProposalInputSchema.parse(await context.req.json()), "runtime", context.get("requestId")), context.get("requestId")), 201));
  app.post("/api/v2/finance/change-proposals/:id/resolve", async (context) => context.json(success(finance.decideChangeProposal(context.req.param("id"), financeChangeProposalDecisionSchema.parse(await context.req.json()), context.get("requestId")), context.get("requestId"))));
  app.get("/api/v2/audit", (context) => context.json(success(store.listAudit(numberQuery(context.req.query("limit"), 100, 1, 500)), context.get("requestId"))));
  app.get("/api/v2/artifacts", (context) => context.json(success(store.listArtifacts(numberQuery(context.req.query("limit"), 100, 1, 500)), context.get("requestId"))));

  return app;
}

function success<T>(data: T, requestId: string) { return { success: true as const, data, requestId }; }
function failure(code: string, message: string, requestId: string, details?: unknown) { return { success: false as const, error: { code, message, ...(details === undefined ? {} : { details }) }, requestId }; }
function friendlyMessage(error: unknown): string { return error instanceof Error ? error.message : "服务器发生未知错误。"; }
function statusFor(code: string): 400 | 401 | 403 | 404 | 409 | 500 | 503 {
  if (code === "RUNTIME_CAPABILITY_REQUIRED" || code === "RUNTIME_CAPABILITY_INVALID" || code === "RUNTIME_CAPABILITY_EXPIRED") return 401;
  if (code === "RUNTIME_CAPABILITY_SCOPE_DENIED") return 403;
  if (code.endsWith("_NOT_FOUND")) return 404;
  if (code.includes("TRANSITION") || code.includes("NOT_RETRYABLE") || code.includes("ALREADY_") || code.includes("NOT_WAITING_") || code.includes("REQUIRES_COMPLETED") || code.includes("HAS_ACTIVE") || code.includes("EXCEEDS_") || code.includes("_CONFLICT") || code.endsWith("_EXISTS") || code === "MAX_ATTEMPTS_REACHED" || code === "WORK_SPEC_NOT_ACTIVE" || code === "WORK_SPEC_RETIRED" || code === "SCHEDULE_REBIND_TARGET_NOT_ACTIVE_WORKFLOW" || code === "APPROVAL_EXPIRED" || code === "SKILL_CONCURRENT_UPDATE" || code === "SKILL_CURRENT_VERSION_MISSING" || code === "SKILL_VERSION_MUST_INCREASE" || code === "SKILL_DRAFT_CHANGED_AFTER_VALIDATION") return 409;
  if (code === "EXECUTOR_UNAVAILABLE") return 503;
  if (code.includes("NOT_ALLOWED") || code.includes("NOT_CHANGEABLE") || code.includes("NOT_REFUNDABLE") || code.includes("MISMATCH") || code.includes("MUST_") || code.includes("REQUIRES_WORKFLOW") || code.includes("PATH_ESCAPE") || code.includes("SECRET_DETECTED") || code.includes("PREFLIGHT_FAILED") || code.endsWith("_REQUIRED") || code.startsWith("INVALID_")) return 400;
  return 500;
}
function runtimeGrant(authorization: string | undefined, scope: RuntimeCapabilityScope, execution: PersonalOsService): RuntimeCapabilityGrant {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  if (!match?.[1]) throw new Error("RUNTIME_CAPABILITY_REQUIRED");
  return execution.getCapabilityAuthority().authorize(match[1], scope);
}
function numberQuery(value: string | undefined, fallback: number, min: number, max: number): number { const parsed = Number(value ?? fallback); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback; }
async function optionalJson(context: { req: { raw: Request; json(): Promise<unknown> } }): Promise<unknown> { return context.req.raw.headers.get("content-length") === "0" ? {} : context.req.json().catch(() => ({})); }
function isTerminal(status: string | undefined): boolean { return ["succeeded", "partially_succeeded", "failed", "cancelled"].includes(status ?? ""); }
function isTerminalEvent(eventType: string): boolean { return ["run.succeeded", "run.partially_succeeded", "run.failed", "run.cancelled"].includes(eventType); }
