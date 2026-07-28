import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, TextArea } from "@radix-ui/themes";
import {
  ArrowClockwise,
  CheckCircle,
  Clock,
  FileCode,
  FolderOpen,
  IdentificationCard,
  Pause,
  Pulse,
  Robot,
  ShieldCheck,
  WarningCircle,
  XCircle
} from "@phosphor-icons/react";
import type { AgentRun, AgentRunEvent, ApprovalRequest } from "@personal-os/domain";
import { api } from "../api";
import { EmptyState, ErrorState, LoadingState, SectionHeader, StatusBadge } from "../components/UI";
import { useSuccessToast } from "../components/SuccessToast";

const terminalStatuses = new Set(["needs_review", "done", "blocked", "failed", "cancelled"]);
const activeStatuses = new Set(["queued", "claimed", "running", "awaiting_approval"]);

function formatTimestamp(value: string | null): string {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

interface StreamPayload {
  run: AgentRun;
  events: AgentRunEvent[];
}

function RunDetailDialog({
  initialRun,
  taskTitle,
  projectName,
  approvals,
  onClose
}: {
  initialRun: AgentRun;
  taskTitle: string;
  projectName: string;
  approvals: ApprovalRequest[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [streamState, setStreamState] = useState<"connecting" | "live" | "reconnecting" | "complete">(terminalStatuses.has(initialRun.status) ? "complete" : "connecting");
  const run = useQuery({ queryKey: ["run", initialRun.id], queryFn: () => api.run(initialRun.id), placeholderData: initialRun });
  const events = useQuery({ queryKey: ["run-events", initialRun.id], queryFn: () => api.runEvents(initialRun.id) });

  useEffect(() => {
    const current = run.data;
    if (!current || terminalStatuses.has(current.status)) {
      setStreamState("complete");
      return;
    }

    let closed = false;
    const source = new EventSource(api.runStreamUrl(initialRun.id));
    setStreamState("connecting");
    source.onopen = () => setStreamState("live");
    source.addEventListener("run", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamPayload;
      queryClient.setQueryData(["run", initialRun.id], payload.run);
      queryClient.setQueryData(["run-events", initialRun.id], { items: payload.events });
      queryClient.setQueryData<{ items: AgentRun[] }>(["runs"], (currentRuns) => currentRuns ? {
        ...currentRuns,
        items: currentRuns.items.map((item) => item.id === payload.run.id ? payload.run : item)
      } : currentRuns);
      if (terminalStatuses.has(payload.run.status)) {
        setStreamState("complete");
        closed = true;
        source.close();
      }
    });
    source.onerror = () => { if (!closed) setStreamState("reconnecting"); };
    return () => { closed = true; source.close(); };
  }, [initialRun.id, queryClient, run.data?.status]);

  const current = run.data ?? initialRun;
  const eventItems = events.data?.items ?? [];
  const runApprovals = approvals.filter((approval) => approval.runId === current.id);
  const streamLabels = { connecting: "正在连接实时事件", live: "实时事件已连接", reconnecting: "连接中断，正在重连", complete: "运行已结束" };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content className="form-dialog run-detail-dialog" maxWidth="860px">
        <div className="run-detail-kicker">
          <span className={`stream-state stream-${streamState}`}><Pulse size={15} weight="bold" />{streamLabels[streamState]}</span>
          <StatusBadge status={current.status} demo={current.mode === "demo"} />
        </div>
        <Dialog.Title>{taskTitle}</Dialog.Title>
        <Dialog.Description>{current.executor === "codex" ? "Codex 执行详情与持久化审计记录。" : "OpenWorker 拉取任务的执行详情与持久化审计记录。"}</Dialog.Description>

        {run.error ? <p className="inline-error">{run.error.message}</p> : null}
        <dl className="run-detail-facts">
          <div><dt><IdentificationCard size={15} />Run ID</dt><dd>{current.id}</dd></div>
          <div><dt><IdentificationCard size={15} />外部会话</dt><dd>{current.externalSessionId ?? "尚未分配"}</dd></div>
          <div><dt><Robot size={15} />执行器</dt><dd>{current.executor}</dd></div>
          <div><dt><FolderOpen size={15} />所属项目</dt><dd>{projectName}</dd></div>
          <div><dt><FolderOpen size={15} />工作目录</dt><dd>{current.workingDirectory ?? "未设置"}</dd></div>
          <div><dt><ArrowClockwise size={15} />执行尝试</dt><dd>第 {current.attempt} 次</dd></div>
          <div><dt><Clock size={15} />开始时间</dt><dd>{formatTimestamp(current.startedAt)}</dd></div>
          <div><dt><Clock size={15} />完成时间</dt><dd>{formatTimestamp(current.completedAt)}</dd></div>
        </dl>

        <section className="run-prompt"><span>执行提示快照</span><pre>{current.promptSnapshot}</pre></section>
        <div className="run-detail-results">
          <section><span>执行结果</span><p>{current.finalResponse ?? "任务仍在运行，完成后会显示摘要。"}</p></section>
          <section><span>验证摘要</span><p>{current.verificationSummary ?? "尚未提交验证摘要。"}</p></section>
        </div>
        {current.errorMessage ? <section className="run-error-detail"><WarningCircle size={18} weight="fill" /><div><span>错误</span><p>{current.errorMessage}</p></div></section> : null}
        <section className="run-artifacts"><span>产物路径</span>{current.artifactPaths.length > 0 ? <div>{current.artifactPaths.map((path) => <code key={path}><FileCode size={14} />{path}</code>)}</div> : <p>没有登记文件产物。</p>}</section>
        {runApprovals.length > 0 ? <section className="run-artifacts"><span>关联审批</span><div>{runApprovals.map((approval) => <code key={approval.id}>{approval.actionType} · {approval.status} · {approval.destination}</code>)}</div></section> : null}

        <section className="run-event-section">
          <header><div><span>事件时间线</span><strong>{eventItems.length} 条</strong></div>{events.isFetching && !events.data ? <small>正在读取</small> : null}</header>
          {events.error ? <p className="inline-error">{events.error.message}</p> : eventItems.length === 0 ? <p className="run-events-empty">尚未记录运行事件。</p> : (
            <ol className="run-event-timeline">{eventItems.map((item) => <li key={item.id}><span><Pulse size={13} weight="bold" /></span><div><strong>{item.eventType}</strong><p>{item.message}</p><time>{formatTimestamp(item.createdAt)}</time></div></li>)}</ol>
          )}
        </section>
        <div className="dialog-actions"><Dialog.Close><Button variant="soft" color="gray">关闭</Button></Dialog.Close></div>
      </Dialog.Content>
    </Dialog.Root>
  );
}

type RunFilter = "all" | "review" | "active" | "attention";

export function ReviewPage() {
  const queryClient = useQueryClient();
  const { showSuccess } = useSuccessToast();
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [filter, setFilter] = useState<RunFilter>("all");
  const [rejectingRun, setRejectingRun] = useState<AgentRun | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const runs = useQuery({ queryKey: ["runs"], queryFn: api.runs, refetchInterval: 4000 });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const approvals = useQuery({ queryKey: ["approvals"], queryFn: () => api.approvals(), refetchInterval: 4000 });

  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["runs"] }),
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["approvals"] })
  ]);
  const accept = useMutation({
    mutationFn: api.acceptRun,
    onSuccess: async (updated) => { setSelectedRun((current) => current?.id === updated.id ? updated : current); showSuccess("Agent 结果已批准，任务已完成"); await refresh(); }
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectRun(id, reason),
    onSuccess: async () => { setRejectingRun(null); setRejectReason(""); showSuccess("结果已驳回，原因已写入审计记录"); await refresh(); }
  });
  const resolveApproval = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => api.resolveApproval(id, decision),
    onSuccess: async (approval) => { showSuccess(approval.status === "approved" ? "操作已批准，Worker 可以继续" : "操作已拒绝，Worker 将跳过该动作"); await refresh(); }
  });
  const cancel = useMutation({ mutationFn: api.cancelRun, onSuccess: async () => { showSuccess("未开始的运行已取消"); await refresh(); } });
  const retry = useMutation({ mutationFn: api.retryRun, onSuccess: async () => { showSuccess("重试运行已创建"); await refresh(); } });

  if (runs.isLoading) return <LoadingState label="正在读取 Agent 运行记录" />;
  if (runs.error) return <ErrorState error={runs.error} retry={() => runs.refetch()} />;
  const allRuns = runs.data?.items ?? [];
  const approvalItems = approvals.data?.items ?? [];
  const pendingApprovals = approvalItems.filter((approval) => approval.status === "pending");
  const taskTitle = (run: AgentRun) => tasks.data?.items.find((task) => task.id === run.taskId)?.title ?? run.promptSnapshot.split("\n").find((line) => line.startsWith("Task: "))?.slice(6) ?? run.promptSnapshot;
  const projectName = (run: AgentRun) => run.projectId ? projects.data?.items.find((project) => project.id === run.projectId)?.name ?? "项目已移除" : "未归属项目";
  const filteredRuns = allRuns.filter((run) => {
    if (filter === "review") return run.status === "needs_review";
    if (filter === "active") return activeStatuses.has(run.status);
    if (filter === "attention") return ["blocked", "failed", "cancelled"].includes(run.status);
    return true;
  });
  const counts = {
    review: allRuns.filter((run) => run.status === "needs_review").length,
    active: allRuns.filter((run) => activeStatuses.has(run.status)).length,
    attention: allRuns.filter((run) => ["blocked", "failed"].includes(run.status)).length
  };

  const actionError = accept.error ?? reject.error ?? resolveApproval.error ?? cancel.error ?? retry.error;

  return (
    <div className="page-stack">
      {selectedRun ? <RunDetailDialog initialRun={selectedRun} taskTitle={taskTitle(selectedRun)} projectName={projectName(selectedRun)} approvals={approvalItems} onClose={() => setSelectedRun(null)} /> : null}
      <Dialog.Root open={Boolean(rejectingRun)} onOpenChange={(open) => { if (!open) { setRejectingRun(null); setRejectReason(""); } }}>
        <Dialog.Content className="form-dialog" maxWidth="520px">
          <Dialog.Title>驳回 Agent 结果</Dialog.Title>
          <Dialog.Description>原因会写入运行事件并把任务标记为阻塞，之后可以修正后重试。</Dialog.Description>
          <form className="form-stack" onSubmit={(event) => { event.preventDefault(); if (rejectingRun) reject.mutate({ id: rejectingRun.id, reason: rejectReason }); }}>
            <label><span>驳回原因</span><TextArea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} required placeholder="说明缺少的证据、产物或验收项" /></label>
            <div className="dialog-actions"><Dialog.Close><Button variant="soft" color="gray">取消</Button></Dialog.Close><Button type="submit" color="red" disabled={!rejectReason.trim()} loading={reject.isPending}>确认驳回</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <section className="review-principle">
        <ShieldCheck size={28} weight="duotone" />
        <div><strong>执行可以自动化，最终判断不能自动化</strong><p>Codex 与 OpenWorker 共用同一套运行记录。外部写入先进入审批，最终结果再进入人工验收。</p></div>
      </section>

      <section className="agent-control-strip" aria-label="Agent 运行概览">
        <button type="button" className={filter === "active" ? "selected" : ""} onClick={() => setFilter("active")}><Pulse size={18} /><span>执行中</span><strong>{counts.active}</strong></button>
        <button type="button" className={filter === "review" ? "selected" : ""} onClick={() => setFilter("review")}><CheckCircle size={18} /><span>待验收</span><strong>{counts.review}</strong></button>
        <button type="button" className={filter === "attention" ? "selected" : ""} onClick={() => setFilter("attention")}><WarningCircle size={18} /><span>需处理</span><strong>{counts.attention}</strong></button>
        <button type="button" className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}><Robot size={18} /><span>全部运行</span><strong>{allRuns.length}</strong></button>
      </section>

      <SectionHeader title="审批收件箱" description="发送消息、写日历、发布和外部写入等动作必须先得到你的明确决定。" />
      {approvals.error ? <ErrorState error={approvals.error} retry={() => approvals.refetch()} /> : pendingApprovals.length === 0 ? <div className="approval-empty"><ShieldCheck size={19} /><span>当前没有待处理的高风险动作</span></div> : (
        <div className="approval-grid">{pendingApprovals.map((approval) => (
          <article className="approval-card" key={approval.id}>
            <header><span>{approval.actionType}</span><strong>等待你的决定</strong></header>
            <h2>{approval.summary}</h2>
            <dl><div><dt>目标</dt><dd>{approval.destination}</dd></div><div><dt>过期</dt><dd>{formatTimestamp(approval.expiresAt)}</dd></div></dl>
            {approval.payloadPreview ? <pre>{approval.payloadPreview}</pre> : null}
            <footer><button className="danger-button" type="button" disabled={resolveApproval.isPending} onClick={() => resolveApproval.mutate({ id: approval.id, decision: "rejected" })}><XCircle size={16} />拒绝</button><button className="primary-button" type="button" disabled={resolveApproval.isPending} onClick={() => resolveApproval.mutate({ id: approval.id, decision: "approved" })}><CheckCircle size={16} />批准操作</button></footer>
          </article>
        ))}</div>
      )}

      <SectionHeader title="Agent Runs" description="统一查看执行器、结果、验证、产物、审批和事件时间线。" />
      {filteredRuns.length === 0 ? <EmptyState title="这个视图里没有运行" body="从任务队列派发 Codex 或 OpenWorker 后，记录会出现在这里。" /> : (
        <div className="review-list">
          {filteredRuns.map((run) => (
            <article className="review-run" key={run.id}>
              <header>
                <div className="run-avatar"><Robot size={22} weight="duotone" /></div>
                <div><span>{run.executor} · {run.mode}</span><h2>{taskTitle(run)}</h2><small>{projectName(run)} · 第 {run.attempt} 次</small></div>
                <StatusBadge status={run.status} demo={run.mode === "demo"} />
              </header>
              {run.mode === "demo" ? <div className="run-warning"><WarningCircle size={17} weight="fill" />该结果由确定性 Demo 适配器生成，只用于验证工作流。</div> : null}
              {run.status === "awaiting_approval" ? <div className="run-warning"><Pause size={17} weight="fill" />Worker 正在等待高风险动作审批。</div> : null}
              <div className="run-result">
                <div><span>执行结果</span><p>{run.finalResponse ?? "任务仍在运行，完成后会在这里显示摘要。"}</p></div>
                <div><span>验证摘要</span><p>{run.verificationSummary ?? "尚未提交验证摘要。"}</p></div>
              </div>
              {run.artifactPaths.length > 0 ? <div className="artifact-list">{run.artifactPaths.map((path) => <span key={path}><FileCode size={15} />{path}</span>)}</div> : null}
              <footer>
                <span>Run {run.id.slice(0, 8)}</span>
                <div className="review-actions">
                  <button className="secondary-button" onClick={() => setSelectedRun(run)}>查看运行详情</button>
                  {["queued", "claimed"].includes(run.status) ? <button className="danger-button" disabled={cancel.isPending} onClick={() => cancel.mutate(run.id)}>取消运行</button> : null}
                  {["failed", "blocked", "cancelled"].includes(run.status) ? <button className="secondary-button" disabled={retry.isPending} onClick={() => retry.mutate(run.id)}><ArrowClockwise size={16} />重试</button> : null}
                  {run.status === "needs_review" ? <button className="danger-button" onClick={() => setRejectingRun(run)}><XCircle size={17} />驳回</button> : null}
                  {run.status === "needs_review" ? <button className="primary-button" onClick={() => accept.mutate(run.id)} disabled={accept.isPending}><CheckCircle size={17} weight="fill" />批准结果</button> : null}
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
      {actionError ? <p className="inline-error">{actionError.message}</p> : null}
    </div>
  );
}
