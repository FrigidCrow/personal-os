import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog } from "@radix-ui/themes";
import { CheckCircle, Clock, FileCode, FolderOpen, IdentificationCard, Pulse, Robot, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import type { CodexRun, CodexRunEvent } from "@personal-os/domain";
import { api } from "../api";
import { EmptyState, ErrorState, LoadingState, SectionHeader, StatusBadge } from "../components/UI";
import { useSuccessToast } from "../components/SuccessToast";

const terminalStatuses = new Set(["needs_review", "done", "blocked", "failed", "cancelled"]);

function formatTimestamp(value: string | null): string {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

interface StreamPayload {
  run: CodexRun;
  events: CodexRunEvent[];
}

function RunDetailDialog({ initialRun, taskTitle, projectName, onClose }: { initialRun: CodexRun; taskTitle: string; projectName: string; onClose: () => void }) {
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
      queryClient.setQueryData<{ items: CodexRun[] }>(["runs"], (currentRuns) => currentRuns ? {
        ...currentRuns,
        items: currentRuns.items.map((item) => item.id === payload.run.id ? payload.run : item)
      } : currentRuns);
      if (terminalStatuses.has(payload.run.status)) {
        setStreamState("complete");
        closed = true;
        source.close();
      }
    });
    source.onerror = () => {
      if (!closed) setStreamState("reconnecting");
    };
    return () => {
      closed = true;
      source.close();
    };
  }, [initialRun.id, queryClient, run.data?.status]);

  const current = run.data ?? initialRun;
  const eventItems = events.data?.items ?? [];
  const streamLabels = { connecting: "正在连接实时事件", live: "实时事件已连接", reconnecting: "连接中断，正在重连", complete: "运行已结束" };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content className="form-dialog run-detail-dialog" maxWidth="820px">
        <div className="run-detail-kicker">
          <span className={`stream-state stream-${streamState}`}><Pulse size={15} weight="bold" />{streamLabels[streamState]}</span>
          <StatusBadge status={current.status} demo={current.mode === "demo"} />
        </div>
        <Dialog.Title>{taskTitle}</Dialog.Title>
        <Dialog.Description>{current.mode === "demo" ? "确定性 Demo 运行详情，仅用于验证工作流。" : "Live Codex 运行详情和持久化审计记录。"}</Dialog.Description>

        {run.error ? <p className="inline-error">{run.error.message}</p> : null}
        <dl className="run-detail-facts">
          <div><dt><IdentificationCard size={15} />Run ID</dt><dd>{current.id}</dd></div>
          <div><dt><IdentificationCard size={15} />Thread ID</dt><dd>{current.threadId ?? "尚未分配"}</dd></div>
          <div><dt><FolderOpen size={15} />所属项目</dt><dd>{projectName}</dd></div>
          <div><dt><FolderOpen size={15} />工作目录</dt><dd>{current.workingDirectory ?? "未设置"}</dd></div>
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

export function ReviewPage() {
  const queryClient = useQueryClient();
  const { showSuccess } = useSuccessToast();
  const [selectedRun, setSelectedRun] = useState<CodexRun | null>(null);
  const runs = useQuery({ queryKey: ["runs"], queryFn: api.runs, refetchInterval: 4000 });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const accept = useMutation({
    mutationFn: api.acceptRun,
    onSuccess: async (updated) => {
      setSelectedRun((current) => current?.id === updated.id ? updated : current);
      showSuccess("Codex 结果已批准，任务已完成");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });

  if (runs.isLoading) return <LoadingState label="正在读取 Codex 运行记录" />;
  if (runs.error) return <ErrorState error={runs.error} retry={() => runs.refetch()} />;
  const items = runs.data?.items ?? [];
  const taskTitle = (run: CodexRun) => tasks.data?.items.find((task) => task.id === run.taskId)?.title ?? run.promptSnapshot.split("\n").find((line) => line.startsWith("Task: "))?.slice(6) ?? run.promptSnapshot;
  const projectName = (run: CodexRun) => run.projectId ? projects.data?.items.find((project) => project.id === run.projectId)?.name ?? "项目已移除" : "未归属项目";

  return (
    <div className="page-stack">
      {selectedRun ? <RunDetailDialog initialRun={selectedRun} taskTitle={taskTitle(selectedRun)} projectName={projectName(selectedRun)} onClose={() => setSelectedRun(null)} /> : null}
      <section className="review-principle">
        <ShieldCheck size={26} weight="duotone" />
        <div><strong>人工批准是完成条件</strong><p>Codex 可以执行、测试并提交结果，但不能自行把任务标记为最终完成。</p></div>
      </section>
      <SectionHeader title="执行记录" description="打开运行详情可查看线程、工作目录、提示快照和实时事件。Demo 与 Live 结果始终明确区分。" />
      {items.length === 0 ? <EmptyState title="没有等待审查的结果" body="从 Ready 任务中选择一个可委派事项。" /> : (
        <div className="review-list">
          {items.map((run) => (
            <article className="review-run" key={run.id}>
              <header>
                <div className="run-avatar"><Robot size={22} weight="duotone" /></div>
                <div><span>{run.mode === "demo" ? "Demo 适配器" : "Live Codex"}</span><h2>{taskTitle(run)}</h2><small>{projectName(run)}</small></div>
                <StatusBadge status={run.status} demo={run.mode === "demo"} />
              </header>
              {run.mode === "demo" ? <div className="run-warning"><WarningCircle size={17} weight="fill" />该结果由确定性 Demo 适配器生成，只用于验证工作流。</div> : null}
              <div className="run-result">
                <div><span>执行结果</span><p>{run.finalResponse ?? "任务仍在运行，完成后会在这里显示摘要。"}</p></div>
                <div><span>验证摘要</span><p>{run.verificationSummary ?? "尚未提交验证摘要。"}</p></div>
              </div>
              {run.artifactPaths.length > 0 ? <div className="artifact-list">{run.artifactPaths.map((path) => <span key={path}><FileCode size={15} />{path}</span>)}</div> : null}
              <footer>
                <span>Run {run.id.slice(0, 8)}</span>
                <div className="review-actions"><button className="secondary-button" onClick={() => setSelectedRun(run)}>查看运行详情</button>{run.status === "needs_review" ? <button className="primary-button" onClick={() => accept.mutate(run.id)} disabled={accept.isPending}><CheckCircle size={17} weight="fill" />批准结果</button> : null}</div>
              </footer>
            </article>
          ))}
        </div>
      )}
      {accept.error ? <p className="inline-error">{accept.error.message}</p> : null}
    </div>
  );
}
