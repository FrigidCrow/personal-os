import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowClockwiseIcon, BookOpenTextIcon, CheckCircleIcon, CoinsIcon, FileIcon, ListChecksIcon, PaperPlaneTiltIcon, PlusIcon, StopIcon, TerminalWindowIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { Approval, Artifact, Project, Run, RunCheckpoint, RunDeposition, RunEvent, WorkSpec } from "@personal-os/vnext-contracts";
import { useLocation } from "wouter";
import { api, post } from "../api";
import { EmptyBlock, ErrorBlock, Field, LoadingBlock, PageHeader, Status, errorMessage, formatDate } from "../components";

const streamEvents = [
  "run.queued", "run.running", "run.waiting_input", "run.waiting_approval", "run.succeeded", "run.partially_succeeded", "run.failed", "run.cancelled",
  "executor.started", "executor.output", "executor.stdout", "executor.stderr", "executor.error",
  "runtime.session", "runtime.output", "runtime.usage", "runtime.command", "runtime.file_change", "runtime.warning",
  "runtime.tool_proposed", "runtime.tool_started", "runtime.tool_finished", "runtime.waiting_input", "runtime.waiting_approval",
  "approval.requested", "artifact.created", "checkpoint.running", "checkpoint.completed", "checkpoint.failed", "checkpoint.reused", "deposition.succeeded", "deposition.failed", "run.cost_recorded", "run.review_accepted", "run.review_rejected"
];

export function RunsPage({ selectedId }: { selectedId?: string } = {}) {
  const client = useQueryClient();
  const [, navigate] = useLocation();
  const initial = selectedId ?? new URLSearchParams(window.location.search).get("selected");
  const [selected, setSelected] = useState<string | null>(initial);
  const [composer, setComposer] = useState(false);
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api<Run[]>("/runs"), refetchInterval: 4_000 });
  const specs = useQuery({ queryKey: ["work-specs"], queryFn: () => api<WorkSpec[]>("/work-specs") });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const currentId = selected ?? runs.data?.[0]?.id ?? null;
  const current = runs.data?.find((item) => item.id === currentId) ?? null;
  const events = useQuery({ queryKey: ["run-events", currentId], queryFn: () => api<RunEvent[]>(`/runs/${currentId}/events`), enabled: Boolean(currentId) });
  const approvals = useQuery({ queryKey: ["approvals"], queryFn: () => api<Approval[]>("/approvals"), refetchInterval: 4_000 });
  const artifacts = useQuery({ queryKey: ["run-artifacts", currentId], queryFn: () => api<Artifact[]>(`/runs/${currentId}/artifacts`), enabled: Boolean(currentId) });
  const checkpoints = useQuery({ queryKey: ["run-checkpoints", currentId], queryFn: () => api<RunCheckpoint[]>(`/runs/${currentId}/checkpoints`), enabled: Boolean(currentId) });
  const deposition = useQuery({ queryKey: ["run-deposition", currentId], queryFn: () => api<RunDeposition | null>(`/runs/${currentId}/deposition`), enabled: Boolean(currentId) });
  useRunStream(currentId, client);
  useEffect(() => { if (selectedId) setSelected(selectedId); }, [selectedId]);
  const createSpec = useMutation({ mutationFn: async (input: unknown) => {
    const spec = await post<WorkSpec>("/work-specs", input);
    const run = await post<Run>(`/work-specs/${spec.id}/runs`, { start: true });
    return { spec, run };
  }, onSuccess: ({ spec, run }) => {
    client.setQueryData<WorkSpec[]>(["work-specs"], (current = []) => current.some((item) => item.id === spec.id) ? current : [spec, ...current]);
    client.setQueryData<Run[]>(["runs"], (current = []) => current.some((item) => item.id === run.id) ? current.map((item) => item.id === run.id ? run : item) : [run, ...current]);
    setSelected(run.id);
    navigate(`/runs/${run.id}`);
    setComposer(false);
    void Promise.all([client.invalidateQueries({ queryKey: ["runs"] }), client.invalidateQueries({ queryKey: ["work-specs"] })]);
  } });
  const action = useMutation({ mutationFn: ({ id, verb, body }: { id: string; verb: string; body?: unknown }) => post<Run>(`/runs/${id}/${verb}`, body), onSuccess: (run) => { setSelected(run.id); navigate(`/runs/${run.id}`); void Promise.all([client.invalidateQueries({ queryKey: ["runs"] }), client.invalidateQueries({ queryKey: ["run-checkpoints", run.id] }), client.invalidateQueries({ queryKey: ["run-deposition", run.id] })]); } });
  const governance = useMutation({ mutationFn: ({ path, body }: { path: string; body?: unknown }) => post<unknown>(path, body), onSuccess: async (result) => {
    if (isRun(result)) client.setQueryData<Run[]>(["runs"], (current = []) => current.map((run) => run.id === result.id ? result : run));
    await Promise.all([
      client.invalidateQueries({ queryKey: ["runs"] }),
      client.invalidateQueries({ queryKey: ["approvals"] }),
      client.invalidateQueries({ queryKey: ["run-events", currentId] }),
      client.invalidateQueries({ queryKey: ["run-artifacts", currentId] }),
      client.invalidateQueries({ queryKey: ["run-checkpoints", currentId] }),
      client.invalidateQueries({ queryKey: ["run-deposition", currentId] }),
      client.invalidateQueries({ queryKey: ["depositions"] })
    ]);
  } });
  if (runs.isLoading || specs.isLoading || projects.isLoading) return <LoadingBlock />;
  if (runs.error || specs.error || projects.error) return <ErrorBlock error={runs.error ?? specs.error ?? projects.error} />;
  return <div className="page-stack runs-page">
    <PageHeader title="运行" description="这里显示真实执行过程，不再维护一套任务看板。" actions={<button className="button primary" onClick={() => setComposer((value) => !value)}><PlusIcon /> 发起运行</button>} />
    {composer && <RunComposer projects={projects.data ?? []} pending={createSpec.isPending} error={createSpec.error} onSubmit={(input) => createSpec.mutate(input)} />}
    {(runs.data ?? []).length === 0 ? <EmptyBlock title="还没有运行" description="发起一项工作后，日志、状态、错误和重试都会留在这里。" /> : <div className="run-workbench">
      <aside className="run-index">{runs.data?.map((run) => <button className={run.id === currentId ? "selected" : ""} key={run.id} onClick={() => { setSelected(run.id); navigate(`/runs/${run.id}`); }}><div><strong>{specs.data?.find((item) => item.id === run.workSpecId)?.title ?? run.id.slice(0, 8)}</strong><small>{formatDate(run.createdAt)}，尝试 {run.attempt}</small></div><Status value={run.status} /></button>)}</aside>
      <section className="run-detail">{current && <><header><div><span className="runtime-label"><TerminalWindowIcon /> {current.executorType}</span><h2>{specs.data?.find((item) => item.id === current.workSpecId)?.title ?? "运行详情"}</h2><p>{current.id}</p></div><div className="row-actions"><Status value={current.status} />{["queued", "running", "waiting_input", "waiting_approval"].includes(current.status) && <button className="button danger small" onClick={() => action.mutate({ id: current.id, verb: "cancel" })}><StopIcon /> 取消</button>}{["failed", "cancelled", "partially_succeeded"].includes(current.status) && <><button className="button secondary small" onClick={() => action.mutate({ id: current.id, verb: "retry", body: { mode: "resume" } })}><ArrowClockwiseIcon /> 继续已完成步骤</button><button className="button ghost small" onClick={() => action.mutate({ id: current.id, verb: "retry", body: { mode: "restart" } })}>全部重做</button></>}</div></header>
        {current.errorMessage && <div className="inline-error"><strong>{current.errorCode}</strong><span>{current.errorMessage}</span></div>}
        <CheckpointPanel values={checkpoints.data ?? []} loading={checkpoints.isLoading} />
        <GovernancePanel run={current} approval={approvals.data?.find((item) => item.runId === current.id && item.status === "pending") ?? null} artifacts={artifacts.data ?? []} deposition={deposition.data ?? null} pending={governance.isPending || createSpec.isPending || action.isPending} error={governance.error} onAction={(path, body) => governance.mutate({ path, body })} />
        <div className="terminal" role="log" aria-live="polite">{events.isLoading ? <span className="terminal-muted">正在连接日志...</span> : events.data?.map((event) => <div className={`terminal-line terminal-${event.level}`} key={event.id}><time>{new Date(event.createdAt).toLocaleTimeString("zh-CN", { hour12: false })}</time><span>{event.source}</span><p>{event.message}</p></div>)}</div>
        <div className="run-result"><h3>执行结果</h3>{current.result ? <pre>{JSON.stringify(current.result, null, 2)}</pre> : <p className="quiet">运行结束后，结构化结果会显示在这里。</p>}</div>
      </>}</section>
    </div>}
  </div>;
}

function CheckpointPanel({ values, loading }: { values: RunCheckpoint[]; loading: boolean }) {
  return <section className="checkpoint-panel" aria-label="执行步骤"><div className="checkpoint-heading"><span><ListChecksIcon /><strong>执行步骤</strong></span><small>{values.filter((item) => item.status === "completed" || item.status === "reused").length}/{values.length} 可复用</small></div>{loading ? <p className="quiet">正在读取步骤...</p> : values.length === 0 ? <p className="quiet">Runtime 保存检查点后，这里会显示可恢复步骤。</p> : <div className="checkpoint-list">{values.map((item) => <div className={`checkpoint-item checkpoint-${item.status}`} key={item.id}><span className="checkpoint-marker" /><div><strong>{item.label}</strong><p>{item.summary}</p><small>{item.stepKey}{item.sourceCheckpointId ? "，来自上一次运行" : ""}</small></div><Status value={item.status} /></div>)}</div>}</section>;
}

function GovernancePanel({ run, approval, artifacts, deposition, pending, error, onAction }: { run: Run; approval: Approval | null; artifacts: Artifact[]; deposition: RunDeposition | null; pending: boolean; error: unknown; onAction(path: string, body?: unknown): void }) {
  const [answer, setAnswer] = useState("");
  const [comment, setComment] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("CNY");
  const request = resultRequest(run.result);
  const terminal = ["succeeded", "partially_succeeded", "failed", "cancelled"].includes(run.status);
  const costMinor = parseMinorUnits(cost);
  return <section className="governance-panel" aria-label="运行治理">
    {run.status === "waiting_input" && <form onSubmit={(event) => { event.preventDefault(); onAction(`/runs/${run.id}/input`, { answer }); }} className="governance-request"><div><span className="governance-kicker">等待你的输入</span><strong>{String(request.question ?? request.prompt ?? "Runtime 需要补充信息后才能继续。")}</strong></div><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} required placeholder="输入答案；提交后会恢复同一个 Runtime 会话" /><button className="button primary small" disabled={pending || !answer.trim()}><PaperPlaneTiltIcon /> 继续运行</button></form>}
    {run.status === "waiting_approval" && approval && <div className="governance-request approval-request"><div><span className="governance-kicker">{approval.riskLevel.toUpperCase()} · 待审批</span><strong>{approval.summary}</strong><small>到期：{approval.expiresAt ? formatDate(approval.expiresAt) : "无"}</small></div><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="可选：审批备注" /><div className="row-actions"><button className="button primary small" disabled={pending} onClick={() => onAction(`/approvals/${approval.id}/resolve`, { decision: "approved", comment })}><CheckCircleIcon /> 批准并继续</button><button className="button danger small" disabled={pending} onClick={() => onAction(`/approvals/${approval.id}/resolve`, { decision: "rejected", comment })}><WarningCircleIcon /> 拒绝</button></div></div>}
    <div className="governance-facts">
      <div><span>人工验收</span><strong>{reviewLabel(run.reviewStatus)}</strong>{run.reviewComment && <small>{run.reviewComment}</small>}</div>
      <div><span>Runtime 用量</span><strong>{run.usage !== null ? "已记录" : "未提供"}</strong>{run.usage !== null && <pre>{JSON.stringify(run.usage, null, 2)}</pre>}</div>
      <div><span>实际成本</span><strong>{run.actualCostMinor === null ? "待录入" : `${run.actualCostCurrency} ${(run.actualCostMinor / 100).toFixed(2)}`}</strong><small>{run.costSource === "provider_bill" ? "供应商账单" : run.costSource === "manual_receipt" ? "人工凭证" : "不根据 Token 猜测金额"}</small></div>
      <div><span>生成物</span><strong>{artifacts.length} 项</strong>{artifacts.slice(0, 3).map((item) => <small key={item.id}><FileIcon /> {item.uri}</small>)}</div>
    </div>
    {deposition && <div className={`deposition-state deposition-${deposition.status}`}><BookOpenTextIcon /><div><span>Obsidian 沉淀</span><strong>{deposition.status === "succeeded" ? deposition.relativePath : deposition.status === "failed" ? "写入失败" : "正在写入"}</strong><small>{deposition.status === "failed" ? deposition.errorMessage : `已尝试 ${deposition.attempts} 次`}</small></div><Status value={deposition.status} />{deposition.status === "failed" && <button className="button secondary small" disabled={pending} onClick={() => onAction(`/runs/${run.id}/deposition/retry`)}>重新沉淀</button>}</div>}
    {run.reviewStatus === "pending" && <div className="governance-actions"><Field label="验收备注"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="结果是否达到目标" /></Field><div className="row-actions"><button className="button primary small" disabled={pending} onClick={() => onAction(`/runs/${run.id}/accept`, { comment })}><CheckCircleIcon /> 验收通过</button><button className="button danger small" disabled={pending} onClick={() => onAction(`/runs/${run.id}/reject`, { comment })}><WarningCircleIcon /> 驳回结果</button></div></div>}
    {terminal && run.actualCostMinor === null && <form className="cost-form" onSubmit={(event) => { event.preventDefault(); if (costMinor !== null) onAction(`/runs/${run.id}/cost`, { amountMinor: costMinor, currency, source: "manual_receipt" }); }}><CoinsIcon /><Field label="实际成本" hint="仅录入账单或凭证确认的金额。"><input inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0.00" required /></Field><Field label="币种"><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>CNY</option><option>JPY</option><option>USD</option></select></Field><button className="button secondary small" disabled={pending || costMinor === null}>记录成本</button></form>}
    {Boolean(error) && <p className="form-error">{errorMessage(error, "治理操作失败")}</p>}
  </section>;
}

function parseMinorUnits(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const minor = BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}

function resultRequest(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object" || Array.isArray(result)) return {};
  const request = (result as Record<string, unknown>).request;
  return request && typeof request === "object" && !Array.isArray(request) ? request as Record<string, unknown> : {};
}

function isRun(value: unknown): value is Run {
  return Boolean(value && typeof value === "object" && "id" in value && "workSpecId" in value && "reviewStatus" in value);
}

function reviewLabel(status: Run["reviewStatus"]): string {
  return status === "pending" ? "待验收" : status === "accepted" ? "已通过" : status === "rejected" ? "已驳回" : "无需验收";
}

function RunComposer({ projects, pending, error, onSubmit }: { projects: Project[]; pending: boolean; error: unknown; onSubmit(input: unknown): void }) {
  const [runtime, setRuntime] = useState("internal");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = runtimeInput(runtime, data);
    onSubmit({ kind: "one_off", title: data.get("title"), instructions: data.get("instructions"), executorType: runtime, input, timeoutSeconds: Number(data.get("timeoutSeconds") ?? 1800), maxAttempts: 3, lifecycleStatus: "active", projectId: data.get("projectId") || null });
  };
  return <form className="editor-panel" onSubmit={submit}><div className="form-grid"><Field label="工作名称"><input name="title" required autoFocus /></Field><Field label="Runtime"><select value={runtime} onChange={(event) => setRuntime(event.target.value)}><option value="internal">Internal</option><option value="process">本地 Python / Node</option><option value="codex">Codex</option><option value="openworker">OpenWorker</option></select></Field><ProjectField runtime={runtime} projects={projects} /><Field label="执行要求"><textarea name="instructions" rows={3} required /></Field><RuntimeFields runtime={runtime} /><Field label="超时秒数"><input name="timeoutSeconds" type="number" min="1" max="86400" defaultValue="1800" /></Field></div>{runtime === "codex" && projects.every((item) => !item.repositoryPath) && <p className="form-error">Codex 需要先创建并绑定一个本地 Git 项目。</p>}{Boolean(error) && <p className="form-error">{errorMessage(error, "运行创建失败")}</p>}<button className="button primary" disabled={pending || (runtime === "codex" && projects.every((item) => !item.repositoryPath))}><PaperPlaneTiltIcon /> {pending ? "正在发起" : "开始运行"}</button></form>;
}

function ProjectField({ runtime, projects }: { runtime: string; projects: Project[] }) {
  const choices = runtime === "codex" ? projects.filter((item) => item.repositoryPath) : projects;
  return <Field label="所属项目" hint={runtime === "codex" ? "必须选择一个已有 Git 仓库的项目。" : "可选；用于聚合运行、成果和经营事实。"}><select name="projectId" required={runtime === "codex"}><option value="">{runtime === "codex" ? "请选择 Git 项目" : "不绑定项目"}</option>{choices.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>;
}

function RuntimeFields({ runtime }: { runtime: string }) {
  if (runtime === "internal") return <><Field label="输出消息"><input name="message" defaultValue="运行完成" /></Field><Field label="延迟毫秒" hint="可用于验证取消和实时状态。"><input name="delayMs" type="number" min="0" max="60000" defaultValue="0" /></Field></>;
  if (runtime === "process") return <><Field label="命令"><select name="command"><option value="python3">python3</option><option value="node">node</option></select></Field><Field label="参数"><input name="args" placeholder="-c print('ok')" /></Field><Field label="工作目录"><input name="cwd" required /></Field></>;
  return runtime === "codex" ? <><Field label="文件权限"><select name="sandboxMode" defaultValue="read-only"><option value="read-only">只读</option><option value="workspace-write">允许修改项目</option></select></Field><Field label="联网能力" hint="关闭时不会启用网络或网页搜索。"><label className="check-field"><input type="checkbox" name="networkAccess" /> 允许网络与网页搜索</label></Field></> : <Field label="OpenWorker Agent"><select name="agent" defaultValue="cowork"><option value="cowork">Cowork</option><option value="code">Code</option></select></Field>;
}

function runtimeInput(runtime: string, data: FormData): unknown {
  if (runtime === "internal") return { operation: "echo", message: data.get("message") || "运行完成", delayMs: Number(data.get("delayMs") ?? 0) };
  if (runtime === "process") return { command: data.get("command"), args: String(data.get("args") ?? "").split(" ").filter(Boolean), cwd: data.get("cwd") };
  if (runtime === "codex") {
    const networkAccess = data.get("networkAccess") === "on";
    return { runtime: { sandboxMode: data.get("sandboxMode") || "read-only", networkAccess, webSearch: networkAccess } };
  }
  return { runtime: { agent: data.get("agent") || "cowork" } };
}

function useRunStream(runId: string | null, client: ReturnType<typeof useQueryClient>) {
  const stableEvents = useMemo(() => streamEvents, []);
  useEffect(() => {
    if (!runId) return;
    const source = new EventSource(`/api/v2/runs/${runId}/events/stream`);
    const receive = (raw: Event) => {
      const event = JSON.parse((raw as MessageEvent<string>).data) as RunEvent;
      client.setQueryData<RunEvent[]>(["run-events", runId], (current = []) => current.some((item) => item.id === event.id) ? current : [...current, event]);
      if (event.eventType.startsWith("run.")) void client.invalidateQueries({ queryKey: ["runs"] });
      if (event.eventType.startsWith("checkpoint.")) void client.invalidateQueries({ queryKey: ["run-checkpoints", runId] });
      if (event.eventType.startsWith("deposition.")) void client.invalidateQueries({ queryKey: ["run-deposition", runId] });
    };
    for (const event of stableEvents) source.addEventListener(event, receive);
    return () => { for (const event of stableEvents) source.removeEventListener(event, receive); source.close(); };
  }, [client, runId, stableEvents]);
}
