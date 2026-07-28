import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, Button, Dialog, Select, TextArea, TextField } from "@radix-ui/themes";
import { ArrowRight, PencilSimple, Plus, Robot, Trash, User } from "@phosphor-icons/react";
import { Link } from "wouter";
import { canTransitionTask, type DelegationMode, type Priority, type Task, type TaskInput, type TaskStatus } from "@personal-os/domain";
import { api } from "../api";
import { EmptyState, ErrorState, formatDate, LoadingState, SectionHeader, StatusBadge } from "../components/UI";
import { useSuccessToast } from "../components/SuccessToast";

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

const priorityLabels: Record<Priority, string> = { low: "低", medium: "中", high: "高", critical: "关键" };
const delegationLabels: Record<DelegationMode, string> = { human_only: "本人处理", codex_ready: "Codex 可执行", mixed: "人机协作" };
const interactiveSelector = "button, a, input, textarea, select, [role='button']";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function taskToForm(task: Task): TaskInput {
  return {
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    delegationMode: task.delegationMode,
    priority: task.priority,
    dueDate: task.dueDate,
    acceptanceCriteria: [...task.acceptanceCriteria]
  };
}

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

interface PointerDrag {
  task: Task;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  cleanup?: () => void;
}

export function TasksPage() {
  const queryClient = useQueryClient();
  const { showSuccess } = useSuccessToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TaskInput>(initialTask);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailForm, setDetailForm] = useState<TaskInput>(initialTask);
  const [editingDetail, setEditingDetail] = useState(false);
  const [assignmentTask, setAssignmentTask] = useState<Task | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<"demo" | "live">("demo");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TaskStatus | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const pointerDrag = useRef<PointerDrag | null>(null);
  const suppressCardClickUntil = useRef(0);
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const runs = useQuery({ queryKey: ["runs"], queryFn: api.runs });
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["runs"] })
  ]);
  const createTask = useMutation({ mutationFn: api.createTask, onSuccess: async () => { setOpen(false); setForm(initialTask); showSuccess("任务已创建"); await refresh(); } });
  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => api.transitionTask(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previous = queryClient.getQueryData<{ items: Task[] }>(["tasks"]);
      queryClient.setQueryData<{ items: Task[] }>(["tasks"], (current) => current ? {
        ...current,
        items: current.items.map((task) => task.id === id ? { ...task, status } : task)
      } : current);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks"], context.previous);
    },
    onSuccess: (updatedTask) => showSuccess(`任务已移动到${columns.find((column) => column.status === updatedTask.status)?.label ?? updatedTask.status}`),
    onSettled: async () => { await refresh(); }
  });
  const updateTask = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Omit<TaskInput, "status"> }) => api.updateTask(id, input),
    onSuccess: async (updatedTask) => {
      setDetailTask(updatedTask);
      setDetailForm(taskToForm(updatedTask));
      setEditingDetail(false);
      showSuccess("任务详情已保存");
      await refresh();
    }
  });
  const deleteTask = useMutation({
    mutationFn: api.deleteTask,
    onSuccess: async () => {
      setDetailTask(null);
      setEditingDetail(false);
      showSuccess("任务已删除");
      await refresh();
    }
  });
  const assign = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: "demo" | "live" }) => api.assignTask(id, mode),
    onSuccess: async () => {
      setAssignmentTask(null);
      showSuccess("任务已交给 Codex，运行状态会持续更新");
      await refresh();
    }
  });

  if (tasks.isLoading) return <LoadingState label="正在读取任务队列" />;
  if (tasks.error) return <ErrorState error={tasks.error} retry={() => tasks.refetch()} />;
  const items = tasks.data?.items ?? [];
  const assignmentProject = assignmentTask?.projectId ? projects.data?.items.find((project) => project.id === assignmentTask.projectId) : null;
  const liveReady = Boolean(assignmentProject?.repositoryPath);
  const draggedTask = items.find((task) => task.id === draggedTaskId) ?? null;

  const clearDragState = () => {
    pointerDrag.current?.cleanup?.();
    pointerDrag.current = null;
    setDraggedTaskId(null);
    setDropStatus(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const canDropTask = (status: TaskStatus) => Boolean(
    draggedTask && draggedTask.status !== status && canTransitionTask(draggedTask.status, status)
  );

  const dropStatusAtPoint = (x: number, y: number, task: Task): TaskStatus | null => {
    for (const element of document.elementsFromPoint(x, y)) {
      const target = element.closest<HTMLElement>("[data-status]");
      const status = target?.dataset.status as TaskStatus | undefined;
      if (status && status !== task.status && canTransitionTask(task.status, status)) return status;
    }
    return null;
  };

  const beginPointerDrag = (event: ReactPointerEvent<HTMLElement>, task: Task) => {
    const isInteractive = (event.target as HTMLElement).closest(interactiveSelector);
    const hasDestination = columns.some((target) => canTransitionTask(task.status, target.status));
    if (event.button !== 0 || isInteractive || transition.isPending || !hasDestination) return;
    const drag: PointerDrag = {
      task,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };
    const onMove = (pointerEvent: globalThis.PointerEvent) => {
      if (pointerEvent.pointerId !== drag.pointerId) return;
      const x = pointerEvent.clientX - drag.startX;
      const y = pointerEvent.clientY - drag.startY;
      if (!drag.active && Math.hypot(x, y) < 6) return;
      pointerEvent.preventDefault();
      if (!drag.active) {
        drag.active = true;
        setDraggedTaskId(drag.task.id);
      }
      setDragOffset({ x, y });
      setDropStatus(dropStatusAtPoint(pointerEvent.clientX, pointerEvent.clientY, drag.task));
    };
    const onEnd = (pointerEvent: globalThis.PointerEvent) => {
      if (pointerEvent.pointerId !== drag.pointerId) return;
      const status = drag.active ? dropStatusAtPoint(pointerEvent.clientX, pointerEvent.clientY, drag.task) : null;
      if (drag.active) suppressCardClickUntil.current = Date.now() + 350;
      clearDragState();
      if (status) transition.mutate({ id: drag.task.id, status });
    };
    const onCancel = (pointerEvent: globalThis.PointerEvent) => {
      if (pointerEvent.pointerId === drag.pointerId) clearDragState();
    };
    drag.cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onCancel);
    };
    pointerDrag.current = drag;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onCancel);
  };

  const openTaskDetail = (event: ReactMouseEvent<HTMLElement>, task: Task) => {
    if (Date.now() < suppressCardClickUntil.current || (event.target as HTMLElement).closest(interactiveSelector)) return;
    setDetailTask(task);
    setDetailForm(taskToForm(task));
    setEditingDetail(false);
    updateTask.reset();
  };

  const openTaskDetailFromKeyboard = (event: ReactKeyboardEvent<HTMLElement>, task: Task) => {
    if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    setDetailTask(task);
    setDetailForm(taskToForm(task));
    setEditingDetail(false);
    updateTask.reset();
  };

  const saveTaskDetail = () => {
    if (!detailTask) return;
    updateTask.mutate({
      id: detailTask.id,
      input: {
        projectId: detailForm.projectId,
        title: detailForm.title,
        description: detailForm.description,
        delegationMode: detailForm.delegationMode,
        priority: detailForm.priority,
        dueDate: detailForm.dueDate,
        acceptanceCriteria: detailForm.acceptanceCriteria
      }
    });
  };

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

      <Dialog.Root open={Boolean(detailTask)} onOpenChange={(nextOpen) => { if (!nextOpen) { setDetailTask(null); setEditingDetail(false); updateTask.reset(); } }}>
        <Dialog.Content className="form-dialog task-detail-dialog" maxWidth="700px">
          {detailTask ? (
            <>
              <div className="task-detail-kicker">
                <span className="priority-text" data-priority={detailTask.priority}>优先级 · {priorityLabels[detailTask.priority]}</span>
                <StatusBadge status={detailTask.status} />
              </div>
              <Dialog.Title className="task-detail-title">{editingDetail ? "编辑任务详情" : detailTask.title}</Dialog.Title>
              <Dialog.Description className="task-detail-description">{editingDetail ? "修改任务内容。状态请在看板中拖拽流转。" : detailTask.description || "这项任务还没有补充说明。"}</Dialog.Description>

              {editingDetail ? (
                <form className="task-detail-edit" onSubmit={(event) => { event.preventDefault(); saveTaskDetail(); }}>
                  <label><span>任务名称</span><TextField.Root value={detailForm.title} onChange={(event) => { const value = event.target.value; setDetailForm((current) => ({ ...current, title: value })); }} required /></label>
                  <label><span>任务说明</span><TextArea value={detailForm.description} onChange={(event) => { const value = event.target.value; setDetailForm((current) => ({ ...current, description: value })); }} /></label>
                  <div className="form-grid">
                    <div className="form-field"><span>所属项目</span><Select.Root value={detailForm.projectId ?? "none"} onValueChange={(value) => setDetailForm((current) => ({ ...current, projectId: value === "none" ? null : value }))}><Select.Trigger aria-label="编辑所属项目" /><Select.Content><Select.Item value="none">暂不归属项目</Select.Item>{projects.data?.items.map((project) => <Select.Item key={project.id} value={project.id}>{project.name}</Select.Item>)}</Select.Content></Select.Root></div>
                    <label><span>截止日期</span><TextField.Root type="date" value={detailForm.dueDate ?? ""} onInput={(event) => { const value = event.currentTarget.value || null; setDetailForm((current) => ({ ...current, dueDate: value })); }} /></label>
                  </div>
                  <div className="form-grid">
                    <div className="form-field"><span>执行方式</span><Select.Root value={detailForm.delegationMode} onValueChange={(value) => setDetailForm((current) => ({ ...current, delegationMode: value as DelegationMode }))}><Select.Trigger aria-label="编辑执行方式" /><Select.Content><Select.Item value="human_only">本人处理</Select.Item><Select.Item value="codex_ready">Codex 可执行</Select.Item><Select.Item value="mixed">人机协作</Select.Item></Select.Content></Select.Root></div>
                    <div className="form-field"><span>优先级</span><Select.Root value={detailForm.priority} onValueChange={(value) => setDetailForm((current) => ({ ...current, priority: value as Priority }))}><Select.Trigger aria-label="编辑优先级" /><Select.Content><Select.Item value="low">低</Select.Item><Select.Item value="medium">中</Select.Item><Select.Item value="high">高</Select.Item><Select.Item value="critical">关键</Select.Item></Select.Content></Select.Root></div>
                  </div>
                  <label><span>验收条件，每行一条</span><TextArea value={detailForm.acceptanceCriteria.join("\n")} onChange={(event) => { const value = event.target.value; setDetailForm((current) => ({ ...current, acceptanceCriteria: value.split("\n").map((item) => item.trim()).filter(Boolean) })); }} /></label>
                  {updateTask.error ? <p className="inline-error">{updateTask.error.message}</p> : null}
                  <footer className="task-detail-footer task-detail-edit-footer">
                    <span>当前状态通过看板拖拽管理，不在详情中直接修改。</span>
                    <div className="task-detail-actions"><Button type="button" variant="soft" color="gray" onClick={() => { setDetailForm(taskToForm(detailTask)); setEditingDetail(false); updateTask.reset(); }}>取消</Button><Button type="submit" loading={updateTask.isPending}>保存更改</Button></div>
                  </footer>
                </form>
              ) : (
                <>
                  <dl className="task-detail-facts">
                    <div><dt>所属项目</dt><dd>{detailTask.projectId ? projects.data?.items.find((project) => project.id === detailTask.projectId)?.name ?? "项目已移除" : "未归属项目"}</dd></div>
                    <div><dt>执行方式</dt><dd>{delegationLabels[detailTask.delegationMode]}</dd></div>
                    <div><dt>截止日期</dt><dd>{formatDate(detailTask.dueDate)}</dd></div>
                  </dl>

                  <section className="task-detail-acceptance">
                    <span>验收条件</span>
                    {detailTask.acceptanceCriteria.length > 0 ? (
                      <ol>{detailTask.acceptanceCriteria.map((criterion, index) => <li key={`${detailTask.id}-${index}`}>{criterion}</li>)}</ol>
                    ) : <p>尚未设置验收条件。</p>}
                  </section>

                  <footer className="task-detail-footer">
                    <div><span>创建于 {formatTimestamp(detailTask.createdAt)}</span><span>更新于 {formatTimestamp(detailTask.updatedAt)}</span></div>
                    <div className="task-detail-actions">
                      <AlertDialog.Root>
                        <AlertDialog.Trigger><button className="danger-button" type="button"><Trash size={15} />删除任务</button></AlertDialog.Trigger>
                        <AlertDialog.Content maxWidth="440px">
                          <AlertDialog.Title>删除任务？</AlertDialog.Title>
                          <AlertDialog.Description>任务“{detailTask.title}”以及关联的 Codex 运行记录会从本地数据库删除。这个操作无法从界面撤销。</AlertDialog.Description>
                          {deleteTask.error ? <p className="inline-error">{deleteTask.error.message}</p> : null}
                          <div className="dialog-actions"><AlertDialog.Cancel><Button variant="soft" color="gray">取消</Button></AlertDialog.Cancel><AlertDialog.Action><Button color="red" loading={deleteTask.isPending} onClick={() => deleteTask.mutate(detailTask.id)}>确认删除</Button></AlertDialog.Action></div>
                        </AlertDialog.Content>
                      </AlertDialog.Root>
                      <button className="secondary-button" type="button" onClick={() => setEditingDetail(true)}><PencilSimple size={15} />编辑详情</button>
                      <Dialog.Close><Button variant="soft" color="gray">关闭</Button></Dialog.Close>
                    </div>
                  </footer>
                </>
              )}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Root>

      {items.length === 0 ? <EmptyState title="任务队列为空" body="先捕获一个事项，再决定由本人还是 Codex 处理。" /> : (
        <div className={`task-board${draggedTask ? " is-dragging" : ""}`}>
          {columns.map((column) => {
            const columnTasks = items.filter((task) => task.status === column.status);
            const isValidTarget = canDropTask(column.status);
            return (
              <section
                className={`task-column${dropStatus === column.status ? " is-drop-target" : ""}${draggedTask && !isValidTarget ? " is-drop-disabled" : ""}`}
                data-status={column.status}
                key={column.status}
              >
                <header><h2>{column.label}</h2><span>{columnTasks.length}</span></header>
                <div className="task-column-body">
                  {columnTasks.length === 0 ? <span className="column-empty">没有任务</span> : columnTasks.map((task) => (
                    <article
                      aria-label={`查看 ${task.title} 详情；拖动可更改状态`}
                      className={`task-ticket${draggedTaskId === task.id ? " is-dragging" : ""}`}
                      data-draggable={!transition.isPending && columns.some((target) => canTransitionTask(task.status, target.status))}
                      data-task-id={task.id}
                      key={task.id}
                      onClick={(event) => openTaskDetail(event, task)}
                      onKeyDown={(event) => openTaskDetailFromKeyboard(event, task)}
                      onPointerDown={(event) => beginPointerDrag(event, task)}
                      style={draggedTaskId === task.id ? { transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(0.98) rotate(1deg)`, zIndex: 3 } : undefined}
                      tabIndex={0}
                    >
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
