import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, Button, Dialog, Select, TextArea, TextField } from "@radix-ui/themes";
import { FolderOpen, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import type { Project, ProjectInput, ProjectLane, ProjectStatus } from "@personal-os/domain";
import { api } from "../api";
import { EmptyState, ErrorState, formatDate, formatMoney, LoadingState, SectionHeader, StatusBadge, laneLabels } from "../components/UI";

const initialProject: ProjectInput = {
  name: "",
  lane: "cash_now",
  status: "planned",
  outcome: "",
  nextAction: "",
  deadline: null,
  expectedRevenue: null,
  actualRevenue: 0,
  repositoryPath: null,
  obsidianPath: null
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: "计划中",
  active: "活跃",
  paused: "暂停",
  blocked: "阻塞",
  completed: "完成",
  archived: "归档"
};

function projectInput(project: Project): ProjectInput {
  return {
    name: project.name,
    lane: project.lane,
    status: project.status,
    outcome: project.outcome,
    nextAction: project.nextAction,
    deadline: project.deadline,
    expectedRevenue: project.expectedRevenue,
    actualRevenue: project.actualRevenue,
    repositoryPath: project.repositoryPath,
    obsidianPath: project.obsidianPath
  };
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectInput>(initialProject);
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    ]);
  };
  const finishEditing = async () => {
    setOpen(false);
    setEditingId(null);
    setForm(initialProject);
    await refresh();
  };
  const createProject = useMutation({ mutationFn: api.createProject, onSuccess: finishEditing });
  const updateProject = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProjectInput }) => api.updateProject(id, input),
    onSuccess: finishEditing
  });
  const deleteProject = useMutation({ mutationFn: api.deleteProject, onSuccess: refresh });

  const openEditor = (project?: Project) => {
    setEditingId(project?.id ?? null);
    setForm(project ? projectInput(project) : initialProject);
    setOpen(true);
  };

  if (projects.isLoading) return <LoadingState label="正在读取项目组合" />;
  if (projects.error) return <ErrorState error={projects.error} retry={() => projects.refetch()} />;
  const items = projects.data?.items ?? [];
  const formError = createProject.error ?? updateProject.error;
  const isSaving = createProject.isPending || updateProject.isPending;

  return (
    <div className="page-stack">
      <SectionHeader
        title="四条主线"
        description="任何项目都必须知道它当前服务于现金流、系统化、收入资产还是个人运营。"
        action={<button className="primary-button" onClick={() => openEditor()}><Plus size={17} weight="bold" />新增项目</button>}
      />

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content className="form-dialog">
          <Dialog.Title>{editingId ? "编辑项目" : "新增项目"}</Dialog.Title>
          <Dialog.Description>结果、下一步和真实仓库路径会成为 Codex 的执行上下文。</Dialog.Description>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            if (editingId) updateProject.mutate({ id: editingId, input: form });
            else createProject.mutate(form);
          }}>
            <label><span>项目名称</span><TextField.Root value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <div className="form-grid">
              <div className="form-field"><span>主线</span><Select.Root value={form.lane} onValueChange={(value) => setForm({ ...form, lane: value as ProjectLane })}><Select.Trigger aria-label="主线" /><Select.Content>{Object.entries(laneLabels).map(([value, label]) => <Select.Item key={value} value={value}>{label}</Select.Item>)}</Select.Content></Select.Root></div>
              <div className="form-field"><span>状态</span><Select.Root value={form.status} onValueChange={(value) => setForm({ ...form, status: value as ProjectStatus })}><Select.Trigger aria-label="状态" /><Select.Content>{Object.entries(projectStatusLabels).map(([value, label]) => <Select.Item key={value} value={value}>{label}</Select.Item>)}</Select.Content></Select.Root></div>
            </div>
            <label><span>最终结果</span><TextArea value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })} required /></label>
            <label><span>下一步行动</span><TextArea value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} required /></label>
            <div className="form-grid">
              <label><span>截止日期</span><TextField.Root type="date" value={form.deadline ?? ""} onChange={(event) => setForm({ ...form, deadline: event.target.value || null })} /></label>
              <label><span>预期收入</span><TextField.Root type="number" min="0" value={form.expectedRevenue ?? ""} onChange={(event) => setForm({ ...form, expectedRevenue: event.target.value ? Number(event.target.value) : null })} /></label>
              <label><span>实际收入</span><TextField.Root type="number" min="0" value={form.actualRevenue ?? ""} onChange={(event) => setForm({ ...form, actualRevenue: event.target.value ? Number(event.target.value) : 0 })} /></label>
            </div>
            <label><span>Git 仓库绝对路径</span><TextField.Root placeholder="/Users/name/dev/project" value={form.repositoryPath ?? ""} onChange={(event) => setForm({ ...form, repositoryPath: event.target.value || null })} /></label>
            <label><span>Obsidian 笔记路径</span><TextField.Root placeholder="Projects/example.md" value={form.obsidianPath ?? ""} onChange={(event) => setForm({ ...form, obsidianPath: event.target.value || null })} /></label>
            {formError ? <p className="inline-error">{formError.message}</p> : null}
            <div className="dialog-actions"><Dialog.Close><Button variant="soft" color="gray">取消</Button></Dialog.Close><Button type="submit" loading={isSaving}>{editingId ? "保存修改" : "创建项目"}</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {items.length === 0 ? <EmptyState title="还没有项目" body="创建第一个项目，并为它写下唯一的下一步行动。" /> : (
        <div className="project-grid">
          {items.map((project) => (
            <article className="project-panel" key={project.id}>
              <header>
                <div className="project-icon"><FolderOpen size={22} weight="duotone" /></div>
                <div><span>{laneLabels[project.lane]}</span><h2>{project.name}</h2></div>
                <StatusBadge status={project.status} />
              </header>
              <div className="project-outcome"><span>结果</span><p>{project.outcome}</p></div>
              <div className="next-action"><span>下一步</span><strong>{project.nextAction}</strong></div>
              <dl className="project-facts">
                <div><dt>截止</dt><dd>{formatDate(project.deadline)}</dd></div>
                <div><dt>预期收入</dt><dd>{formatMoney(project.expectedRevenue ?? 0)}</dd></div>
                <div><dt>实际收入</dt><dd>{formatMoney(project.actualRevenue ?? 0)}</dd></div>
              </dl>
              <footer>
                <div className="project-links">
                  {project.repositoryPath ? <span title={project.repositoryPath}>Git 已连接</span> : <span>未连接 Git</span>}
                  {project.obsidianPath ? <span title={project.obsidianPath}>Obsidian 已连接</span> : <span>未连接 Obsidian</span>}
                </div>
                <div className="project-actions">
                  <button className="icon-button" aria-label={`编辑 ${project.name}`} onClick={() => openEditor(project)}><PencilSimple size={17} /></button>
                  <AlertDialog.Root>
                    <AlertDialog.Trigger><button className="icon-button danger-icon" aria-label={`删除 ${project.name}`}><Trash size={17} /></button></AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="430px">
                      <AlertDialog.Title>删除项目？</AlertDialog.Title>
                      <AlertDialog.Description>项目“{project.name}”会被删除，关联任务和资产会保留并取消项目关联。这个操作无法从界面撤销。</AlertDialog.Description>
                      <div className="dialog-actions"><AlertDialog.Cancel><Button variant="soft" color="gray">取消</Button></AlertDialog.Cancel><AlertDialog.Action><Button color="red" loading={deleteProject.isPending} onClick={() => deleteProject.mutate(project.id)}>确认删除</Button></AlertDialog.Action></div>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
      {deleteProject.error ? <p className="inline-error">{deleteProject.error.message}</p> : null}
    </div>
  );
}
