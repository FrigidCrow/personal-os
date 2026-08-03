import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ArchiveBoxIcon, CodeIcon, FolderOpenIcon, GitBranchIcon, NotePencilIcon, PlusIcon, PulseIcon, WalletIcon } from "@phosphor-icons/react";
import type { Artifact, OperatingUnit, OperatingUnitSummary, Project, Run, WorkSpec } from "@personal-os/vnext-contracts";
import { Link } from "wouter";
import { api, post } from "../api";
import { EmptyBlock, ErrorBlock, Field, LoadingBlock, PageHeader, Status, errorMessage, formatDate, money } from "../components";

export function ProjectsPage({ selectedId }: { selectedId?: string } = {}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const workSpecs = useQuery({ queryKey: ["work-specs"], queryFn: () => api<WorkSpec[]>("/work-specs") });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api<Run[]>("/runs?limit=500") });
  const artifacts = useQuery({ queryKey: ["artifacts"], queryFn: () => api<Artifact[]>("/artifacts?limit=500") });
  const units = useQuery({ queryKey: ["operating-units"], queryFn: () => api<OperatingUnit[]>("/finance/operating-units") });
  const selectedUnit = units.data?.find((item) => item.unitType === "project" && item.referenceId === selectedId) ?? null;
  const summary = useQuery({ queryKey: ["operating-summary", selectedUnit?.id], queryFn: () => api<OperatingUnitSummary>(`/finance/operating-units/${selectedUnit?.id}/summary`), enabled: Boolean(selectedUnit) });
  const create = useMutation({ mutationFn: (input: unknown) => post<Project>("/projects", input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["projects"] }); setOpen(false); } });
  if (projects.isLoading || workSpecs.isLoading || runs.isLoading || artifacts.isLoading || units.isLoading) return <LoadingBlock />;
  if (projects.error || workSpecs.error || runs.error || artifacts.error || units.error) return <ErrorBlock error={projects.error ?? workSpecs.error ?? runs.error ?? artifacts.error ?? units.error} />;
  const selected = selectedId ? projects.data?.find((item) => item.id === selectedId) ?? null : null;
  return <div className="page-stack">
    <PageHeader title={selected ? selected.name : "项目"} description={selected ? "目标、执行、知识和经营事实汇聚在同一个上下文中。" : "每个项目聚合目标、代码、知识、运行和经营结果。"} actions={selected ? <Link className="button secondary" href="/projects"><ArrowLeftIcon /> 全部项目</Link> : <button className="button primary" onClick={() => setOpen((value) => !value)}><PlusIcon /> 新建项目</button>} />
    {open && !selected && <ProjectForm pending={create.isPending} error={create.error} onSubmit={(input) => create.mutate(input)} />}
    {selectedId && !selected ? <EmptyBlock title="项目不存在" description="它可能已归档，或链接来自旧系统。" action={<Link className="button secondary" href="/projects">返回项目</Link>} /> : selected ? <ProjectDetail project={selected} specs={(workSpecs.data ?? []).filter((item) => item.projectId === selected.id)} runs={(runs.data ?? []).filter((item) => item.projectId === selected.id)} artifacts={(artifacts.data ?? []).filter((item) => item.projectId === selected.id)} unit={selectedUnit} summary={summary.data ?? null} summaryLoading={summary.isLoading} /> : (projects.data ?? []).length === 0 ? <EmptyBlock title="还没有项目" description="建立项目后，WorkSpec、运行和资产都可以归到同一个业务目标下。" /> : <div className="project-grid">{projects.data?.map((project, index) => {
      const specs = workSpecs.data?.filter((item) => item.projectId === project.id) ?? [];
      const projectRuns = runs.data?.filter((item) => item.projectId === project.id) ?? [];
      return <Link href={`/projects/${project.id}`} className={`project-item project-item-${index % 3}`} key={project.id}>
        <div className="project-title"><div className="project-mark"><FolderOpenIcon size={22} weight="duotone" /></div><div><h2>{project.name}</h2><Status value={project.status} /></div></div>
        <p>{project.description || "尚未填写项目说明。"}</p>
        <div className="project-context"><span><GitBranchIcon /> {project.repositoryPath || "未绑定 Git"}</span><span><NotePencilIcon /> {project.obsidianPath || "未绑定 Obsidian"}</span></div>
        <footer><span><strong>{specs.length}</strong> 项定义</span><span><strong>{projectRuns.length}</strong> 次运行</span></footer>
      </Link>;
    })}</div>}
  </div>;
}

function ProjectDetail({ project, specs, runs, artifacts, unit, summary, summaryLoading }: { project: Project; specs: WorkSpec[]; runs: Run[]; artifacts: Artifact[]; unit: OperatingUnit | null; summary: OperatingUnitSummary | null; summaryLoading: boolean }) {
  return <div className="project-workspace">
    <section className="panel project-brief"><div className="project-detail-heading"><span className="eyebrow">项目上下文</span><Status value={project.status} /></div><p>{project.description || "尚未填写项目说明。"}</p><dl><div><dt><GitBranchIcon /> Git 仓库</dt><dd>{project.repositoryPath || "未绑定"}</dd></div><div><dt><NotePencilIcon /> Obsidian</dt><dd>{project.obsidianPath || "未绑定"}</dd></div><div><dt>项目 ID</dt><dd>{project.id}</dd></div><div><dt>最近更新</dt><dd>{formatDate(project.updatedAt)}</dd></div></dl></section>
    <section className="project-stat-band" aria-label="项目事实"><ProjectStat icon={<CodeIcon />} label="工作定义" value={String(specs.length)} /><ProjectStat icon={<PulseIcon />} label="运行" value={String(runs.length)} /><ProjectStat icon={<ArchiveBoxIcon />} label="成果" value={String(artifacts.length)} /><ProjectStat icon={<WalletIcon />} label="实际净额" value={summary ? money(summary.actualIncomeMinor - summary.actualExpenseMinor, summary.currency) : unit && summaryLoading ? "读取中" : "未建账"} /></section>
    <div className="project-detail-grid"><section className="panel"><div className="section-heading"><div><h2>执行定义</h2><p>Workflow 是固定 Skill 版本，一次性 WorkSpec 只用于单次运行。</p></div></div><div className="entity-stack">{specs.map((spec) => <Link href={spec.kind === "workflow" ? `/radar/${spec.id}` : "/runs"} key={spec.id}><span><strong>{spec.title}</strong><small>{spec.executorType} · {spec.kind === "workflow" ? "固定 Skill 版本" : "一次性工作"}</small></span><Status value={spec.lifecycleStatus} /></Link>)}{specs.length === 0 && <p className="quiet">这个项目还没有工作定义。</p>}</div></section>
      <section className="panel"><div className="section-heading"><div><h2>最近运行</h2><p>状态和成本都来自统一 Run。</p></div></div><div className="entity-stack">{runs.slice(0, 8).map((run) => <Link href={`/runs/${run.id}`} key={run.id}><span><strong>{specs.find((item) => item.id === run.workSpecId)?.title ?? run.id.slice(0, 8)}</strong><small>{formatDate(run.createdAt)} · {run.actualCostMinor === null ? "成本未确认" : money(run.actualCostMinor, run.actualCostCurrency ?? "CNY")}</small></span><Status value={run.status} /></Link>)}{runs.length === 0 && <p className="quiet">这个项目还没有运行记录。</p>}</div></section>
      <section className="panel"><div className="section-heading"><div><h2>成果</h2><p>文件留在原位置，这里保存来源引用。</p></div></div><div className="entity-stack">{artifacts.slice(0, 8).map((artifact) => <Link href={`/assets/artifacts/${artifact.id}`} key={artifact.id}><span><strong>{artifact.name}</strong><small>{artifact.storageKind} · {artifact.uri}</small></span><ArchiveBoxIcon /></Link>)}{artifacts.length === 0 && <p className="quiet">这个项目还没有登记成果。</p>}</div></section>
      <section className="panel operating-card"><div className="section-heading"><div><h2>投入产出</h2><p>现金分摊、预期金额和时间不会混成一个数字。</p></div><Link href="/assets/finance">打开财务</Link></div>{summary ? <dl><div><dt>实际收入</dt><dd>{money(summary.actualIncomeMinor, summary.currency)}</dd></div><div><dt>实际支出</dt><dd>{money(summary.actualExpenseMinor, summary.currency)}</dd></div><div><dt>预期收入</dt><dd>{money(summary.expectedIncomeMinor, summary.currency)}</dd></div><div><dt>承诺成本</dt><dd>{money(summary.committedCostMinor, summary.currency)}</dd></div><div><dt>投入时间</dt><dd>{Math.floor(summary.timeMinutes / 60)} 小时 {summary.timeMinutes % 60} 分</dd></div></dl> : <p className="quiet">尚未为该项目建立 Operating Unit。可在资产的财务模块中建立并分摊真实交易。</p>}</section>
    </div>
  </div>;
}

function ProjectStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div>{icon}<span>{label}</span><strong>{value}</strong></div>; }

function ProjectForm({ pending, error, onSubmit }: { pending: boolean; error: unknown; onSubmit(input: unknown): void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: data.get("name"), description: data.get("description") ?? "", repositoryPath: String(data.get("repositoryPath") || "") || null, obsidianPath: String(data.get("obsidianPath") || "") || null, status: "active" }); };
  return <form className="editor-panel" onSubmit={submit}><div className="form-grid"><Field label="项目名称"><input name="name" required autoFocus /></Field><Field label="项目说明"><input name="description" /></Field><Field label="Git 路径"><input name="repositoryPath" placeholder="/Users/.../project" /></Field><Field label="Obsidian 路径"><input name="obsidianPath" placeholder="Vault/Projects/..." /></Field></div>{Boolean(error) && <p className="form-error">{errorMessage(error, "创建失败")}</p>}<button className="button primary" disabled={pending}>{pending ? "正在创建" : "保存项目"}</button></form>;
}
