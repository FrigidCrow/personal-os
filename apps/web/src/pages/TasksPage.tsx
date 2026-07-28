import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Select, TextArea, TextField } from "@radix-ui/themes";
import { ArrowRight, Plus, Robot, User } from "@phosphor-icons/react";
import { Link } from "wouter";
import type { DelegationMode, Priority, Task, TaskInput, TaskStatus } from "@personal-os/domain";
import { api } from "../api";
import { EmptyState, ErrorState, formatDate, LoadingState, SectionHeader, StatusBadge } from "../components/UI";

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: "inbox", label: "Inbox" },
  { status: "ready", label: "Ready" },
  { status: "in_progress", label: "In progress" },
  { status: "needs_review", label: "Needs review" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" }
];

const nextAction: Partial<Record<TaskStatus, { status: TaskStatus; label: string }>> = {
  inbox: { status: "ready", label: "整理完成" },
  ready: { status: "in_progress", label: "开始执行" },
  in_progress: { status: "needs_review", label: "提交审查" },
  needs_review: { status: "done", label: "批准完成" },
  blocked: { status: "ready", label: "解除阻塞" }
};

const initialTask: TaskInput = {
  projectId: null,
  title: "",
  description: "",
  status: "inbox",
  delegationMode: "mixed",
  priority: "medium",
  dueDate: null,
  acceptanceCriteria: []
};

export function TasksPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TaskInput>(initialTask);
  const [assignmentTask, setAssignmentTask] = useState<Task | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<"demo" | "live">("demo");
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const runs = useQuery({ queryKey: ["runs"], queryFn: api.runs });
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["runs"] })
  ]);
  const createTask = useMutation({ mutationFn: api.createTask, onSuccess: async () => { setOpen(false); setForm(initialTask); await refresh(); } });
  const transition = useMutation({ mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => api.transitionTask(id, status), onSuccess: refresh });
  const assign = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: "demo" | "live" }) => api.assignTask(id, mode),
    onSuccess: async () => {
      setAssignmentTask(null);
      await refresh();
    }
  });

  if (tasks.isLoading) return <LoadingState label="正在读取任务队列" />;
  if (tasks.error) return <ErrorState error={tasks.error} retry={() => tasks.refetch()} />;
  const items = tasks.data?.items ?? [];
  const assignmentProject = assignmentTask?.projectId ? projects.data?.items.find((project) => project.id === assignmentTask.projectId) : null;
  const liveReady = Boolean(assignmentProject?.repositoryPath);

  return (
    <div className="page-stack">
      <SectionHeader
        title="从输入到验收"
        description="任务只有在通过人工审查后才算完成。"
        action={
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger><button className="primary-button"><Plus size={17} weight="bold" />新增任务</button></Dialog.Trigger>
            <Dialog.Content className="form-dialog">
              <Dialog.Title>新增任务</Dialog.Title>
              <Dialog.Description>任务越具体，Codex 的执行和验收越可靠。</Dialog.Description>
              <form className="form-stack" onSubmit={(event) => { event.preventDefault(); createTask.mutate(form); }}>
                <label><span>任务名称</span><TextField.Root value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
                <label><span>任务说明</span><TextArea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                <div className="form-field"><span>所属项目</span><Select.Root value={form.projectId ?? "none"} onValueChange={(value) => setForm({ ...form, projectId: value === "none" ? null : value })}><Select.Trigger aria-label="所属项目" /><Select.Content><Select.Item value="none">暂不归属项目</Select.Item>{projects.data?.items.map((project) => <Select.Item key={project.id} value={project.id}>{project.name}</Select.Item>)}</Select.Content></Select.Root></div>
                <div className="form-grid">
                  <div className="form-field"><span>委派方式</span><Select.Root value={form.delegationMode} onValueChange={(value) => setForm({ ...form, delegationMode: value as DelegationMode })}><Select.Trigger aria-label="委派方式" /><Select.Content><Select.Item value="human_only">本人处理</Select.Item><Select.Item value="codex_ready">Codex 可执行</Select.Item><Select.Item value="mixed">协作执行</Select.Item></Select.Content></Select.Root></div>
                  <div className="form-field"><span>优先级</span><Select.Root value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as Priority })}><Select.Trigger aria-label="优先级" /><Select.Content><Select.Item value="low">低</Select.Item><Select.Item value="medium">中</Select.Item><Select.Item value="high">高</Select.Item><Select.Item value="critical">关键</Select.Item></Select.Content></Select.Root></div>
                </div>
                <label><span>验收条件，每行一条</span><TextArea value={form.acceptanceCriteria.join("\n")} onChange={(event) => setForm({ ...form, acceptanceCriteria: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} /></label>
                {createTask.error ? <p className="inline-error">{createTask.error.message}</p> : null}
                <div className="dialog-actions"><Dialog.Close><Button variant="soft" color="gray">取消</Button></Dialog.Close><Button type="submit" loading={createTask.isPending}>创建任务</Button></div>
              </form>
            </Dialog.Content>
          </Dialog.Root>
        }
      />

      <Dialog.Root open={Boolean(assignmentTask)} onOpenChange={(nextOpen) => { if (!nextOpen) setAssignmentTask(null); }}>
        <Dialog.Content className="form-dialog" maxWidth="520px">
          <Dialog.Title>交给 Codex</Dialog.Title>
          <Dialog.Description>{assignmentTask?.title}</Dialog.Description>
          <div className="form-stack">
            <div className="form-field"><span>执行模式</span><div className="assignment-mode" role="radiogroup" aria-label="执行模式"><button type="button" role="radio" aria-checked={assignmentMode === "demo"} className={assignmentMode === "demo" ? "selected" : ""} onClick={() => setAssignmentMode("demo")}><strong>Demo</strong><small>只验证状态流转</small></button><button type="button" role="radio" aria-checked={assignmentMode === "live"} className={assignmentMode === "live" ? "selected" : ""} onClick={() => setAssignmentMode("live")}><strong>Live Codex</strong><small>在真实仓库执行</small></button></div></div>
            <div className="assignment-summary">
              <span>{assignmentMode === "demo" ? "Demo 不会修改文件，只验证完整状态流转。" : "Live 会让 Codex 在绑定的 Git 仓库中执行任务，完成后进入人工审查。"}</span>
              <strong>{assignmentProject?.repositoryPath ?? "尚未绑定 Git 仓库路径"}</strong>
            </div>
            {assignmentMode === "live" && !liveReady ? <p className="inline-error">先到项目页绑定真实 Git 仓库绝对路径，才能执行 Live 任务。</p> : null}
            {assign.error ? <p className="inline-error">{assign.error.message}</p> : null}
            <div className="dialog-actions"><Dialog.Close><Button variant="soft" color="gray">取消</Button></Dialog.Close><Button loading={assign.isPending} disabled={!assignmentTask || (assignmentMode === "live" && !liveReady)} onClick={() => assignmentTask && assign.mutate({ id: assignmentTask.id, mode: assignmentMode })}>{assignmentMode === "demo" ? "开始 Demo" : "启动 Live Codex"}</Button></div>
          </div>
        </Dialog.Content>
      </Dialog.Root>

      {items.length === 0 ? <EmptyState title="任务队列为空" body="先捕获一个事项，再决定由本人还是 Codex 处理。" /> : (
        <div className="task-board">
          {columns.map((column) => {
            const columnTasks = items.filter((task) => task.status === column.status);
            return (
              <section className="task-column" key={column.status}>
                <header><h2>{column.label}</h2><span>{columnTasks.length}</span></header>
                <div className="task-column-body">
                  {columnTasks.length === 0 ? <span className="column-empty">没有任务</span> : columnTasks.map((task) => (
                    <article className="task-ticket" key={task.id}>
                      <div className="task-ticket-top"><span className="priority-text" data-priority={task.priority}>{task.priority}</span><StatusBadge status={task.status} /></div>
                      <h3>{task.title}</h3>
                      <p>{task.description || "尚未补充说明。"}</p>
                      <div className="task-meta"><span>{task.delegationMode === "human_only" ? <User size={15} /> : <Robot size={15} />}{task.delegationMode === "human_only" ? "本人" : task.delegationMode === "codex_ready" ? "Codex" : "协作"}</span><span>{formatDate(task.dueDate)}</span></div>
                      {task.acceptanceCriteria.length > 0 ? <div className="acceptance-preview"><span>验收</span><p>{task.acceptanceCriteria[0]}</p></div> : null}
                      <div className="task-actions">
                        {task.status === "ready" && task.delegationMode !== "human_only" ? <button className="compact-button" disabled={assign.isPending} onClick={() => { setAssignmentMode("demo"); setAssignmentTask(task); }}><Robot size={16} />Demo / Live</button> : null}
                        {task.status === "needs_review" && runs.data?.items.some((run) => run.taskId === task.id && run.status === "needs_review") ? <Link className="text-button" href="/review">前往审查<ArrowRight size={15} /></Link> : nextAction[task.status] ? <button className="text-button" disabled={transition.isPending} onClick={() => transition.mutate({ id: task.id, status: nextAction[task.status]!.status })}>{nextAction[task.status]!.label}<ArrowRight size={15} /></button> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {transition.error ? <p className="inline-error">{transition.error.message}</p> : null}
    </div>
  );
}
