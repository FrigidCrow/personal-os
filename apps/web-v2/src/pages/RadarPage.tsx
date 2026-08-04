import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArchiveBoxIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  CrosshairSimpleIcon,
  FingerprintIcon,
  FlaskIcon,
  LockKeyIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TerminalWindowIcon,
  WarningCircleIcon,
  WrenchIcon
} from "@phosphor-icons/react";
import type {
  Artifact,
  KnowledgeVault,
  Project,
  Run,
  RehearsalPromotionGate,
  Schedule,
  SkillCandidate,
  SkillDraftInput,
  SkillDraftValidation,
  SkillSnapshot,
  WorkSpec,
  WorkSpecPreflight,
  WorkflowOperationsSummary
} from "@personal-os/vnext-contracts";
import { Link, useLocation } from "wouter";
import { api, patch, post } from "../api";
import { EmptyBlock, ErrorBlock, Field, LoadingBlock, PageHeader, Status, errorMessage, formatDate } from "../components";

type Composer = "workflow" | "schedule" | "skill" | "revision" | null;

export function RadarPage({ selectedId }: { selectedId?: string } = {}) {
  const client = useQueryClient();
  const [, navigate] = useLocation();
  const [composer, setComposer] = useState<Composer>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const specs = useQuery({ queryKey: ["work-specs"], queryFn: () => api<WorkSpec[]>("/work-specs") });
  const schedules = useQuery({ queryKey: ["schedules"], queryFn: () => api<Schedule[]>("/schedules") });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api<Run[]>("/runs?limit=500") });
  const artifacts = useQuery({ queryKey: ["artifacts"], queryFn: () => api<Artifact[]>("/artifacts?limit=500") });
  const skills = useQuery({ queryKey: ["skills"], queryFn: () => api<SkillSnapshot[]>("/skills") });
  const vaults = useQuery({ queryKey: ["vaults"], queryFn: () => api<KnowledgeVault[]>("/knowledge/vaults") });
  const operations = useQuery({ queryKey: ["workflow-operations"], queryFn: () => api<WorkflowOperationsSummary[]>("/operations/workflows") });
  const refresh = () => {
    for (const queryKey of [["work-specs"], ["schedules"], ["runs"], ["workflow-operations"]]) void client.invalidateQueries({ queryKey });
  };
  const createWorkflow = useMutation({ mutationFn: (input: unknown) => post<WorkSpec>("/work-specs", input), onSuccess: () => { refresh(); setComposer(null); } });
  const createRevision = useMutation({
    mutationFn: (input: unknown) => post<WorkSpec>(`/work-specs/${selectedId}/revisions`, input),
    onSuccess: (created) => { refresh(); setComposer(null); navigate(`/radar/${created.id}`); }
  });
  const createSchedule = useMutation({ mutationFn: (input: unknown) => post<Schedule>("/schedules", input), onSuccess: () => { refresh(); setComposer(null); } });
  const updateSchedule = useMutation({ mutationFn: ({ id, input }: { id: string; input: unknown }) => patch<Schedule>(`/schedules/${id}`, input), onSuccess: () => { refresh(); setEditingScheduleId(null); } });
  const action = useMutation({ mutationFn: ({ id, verb }: { id: string; verb: string }) => post(`/schedules/${id}/${verb}`), onSuccess: refresh });
  const rebind = useMutation({ mutationFn: ({ id, workSpecId }: { id: string; workSpecId: string }) => post<Schedule>(`/schedules/${id}/rebind`, { workSpecId }), onSuccess: refresh });
  const preflight = useMutation({ mutationFn: (id: string) => api<WorkSpecPreflight>(`/work-specs/${id}/preflight`) });

  const queryError = specs.error ?? schedules.error ?? projects.error ?? runs.error ?? artifacts.error ?? skills.error ?? vaults.error ?? operations.error;
  if (specs.isLoading || schedules.isLoading || projects.isLoading || runs.isLoading || artifacts.isLoading || skills.isLoading || vaults.isLoading || operations.isLoading) return <LoadingBlock />;
  if (queryError) return <ErrorBlock error={queryError} />;
  const workflows = (specs.data ?? []).filter((item) => item.kind === "workflow" && item.lifecycleStatus !== "retired");
  const selected = selectedId ? specs.data?.find((item) => item.id === selectedId) ?? null : null;
  const selectedSchedules = (schedules.data ?? []).filter((item) => item.workSpecId === selectedId);
  const actionPending = updateSchedule.isPending || action.isPending || rebind.isPending;
  const actionError = updateSchedule.error ?? action.error ?? rebind.error;

  return <div className="page-stack">
    <PageHeader
      title={selected ? selected.title : "雷达"}
      description={selected ? "检查、运行和升级一个固定的工作流版本。" : "把 Codex 和 OpenWorker 的复杂工作沉淀成能长期运行的流程。"}
      actions={selected ? <div className="button-group">
        <Link className="button secondary" href="/radar"><ArrowLeftIcon /> 全部雷达</Link>
        {selected.kind === "workflow" && <><button className="button secondary" onClick={() => preflight.mutate(selected.id)}><FlaskIcon /> 运行体检</button><button className="button secondary" onClick={() => setComposer("revision")}><WrenchIcon /> 创建新版</button><button className="button primary" onClick={() => setComposer("schedule")}><CalendarDotsIcon /> 添加定时</button></>}
      </div> : <div className="button-group">
        <button className="button secondary" onClick={() => setComposer("skill")}><WrenchIcon /> Skill 工作台</button>
        <button className="button secondary" onClick={() => setComposer("schedule")}><CalendarDotsIcon /> 设置定时</button>
        <button className="button primary" onClick={() => setComposer("workflow")}><PlusIcon /> 新建雷达</button>
      </div>}
    />

    {composer === "skill" && <SkillStudio skills={skills.data ?? []} onClose={() => setComposer(null)} />}
    {composer === "workflow" && <WorkflowForm projects={projects.data ?? []} skills={skills.data ?? []} vaults={vaults.data ?? []} pending={createWorkflow.isPending} error={createWorkflow.error} onSubmit={(input) => createWorkflow.mutate(input)} />}
    {composer === "revision" && selected && <WorkflowForm initial={selected} revision projects={projects.data ?? []} skills={skills.data ?? []} vaults={vaults.data ?? []} pending={createRevision.isPending} error={createRevision.error} onSubmit={(input) => createRevision.mutate(input)} />}
    {composer === "schedule" && <ScheduleForm workflows={workflows} selectedWorkSpecId={selected?.kind === "workflow" ? selected.id : undefined} pending={createSchedule.isPending} error={createSchedule.error} onSubmit={(input) => createSchedule.mutate(input)} />}
    {preflight.data && selected && preflight.data.workSpecId === selected.id && <PreflightPanel value={preflight.data} />}
    {preflight.error && <p className="form-error">{errorMessage(preflight.error, "体检失败")}</p>}

    {selectedId && !selected ? <EmptyBlock title="执行定义不存在" description="它可能来自旧链接，或已经退休。" action={<Link className="button secondary" href="/radar">返回雷达</Link>} /> : selected ? <RadarDetail
      workflow={selected}
      workflows={workflows}
      schedules={selectedSchedules}
      runs={(runs.data ?? []).filter((item) => item.workSpecId === selected.id)}
      artifacts={(artifacts.data ?? []).filter((item) => item.workSpecId === selected.id)}
      editingScheduleId={editingScheduleId}
      pending={actionPending}
      error={actionError}
      onEdit={setEditingScheduleId}
      onUpdate={(id, input) => updateSchedule.mutate({ id, input })}
      onAction={(id, verb) => action.mutate({ id, verb })}
      onRebind={(id, workSpecId) => rebind.mutate({ id, workSpecId })}
    /> : <>
      <OperationsPanel values={operations.data ?? []} />
      <section className="panel"><div className="section-heading"><div><h2>固定工作流</h2><p>每张卡片是一个不可变版本；旧运行不会被新版本改写。</p></div></div>
        {workflows.length === 0 ? <EmptyBlock title="还没有雷达" description="先发布或选择一个 Skill，再创建工作流。" /> : <div className="workflow-grid">{workflows.map((workflow) => {
          const operation = operations.data?.find((item) => item.workSpec.id === workflow.id);
          return <Link href={`/radar/${workflow.id}`} className="workflow-item" key={workflow.id}><div className="workflow-icon"><CrosshairSimpleIcon size={23} weight="duotone" /></div><div className="workflow-copy"><div><h3>{workflow.title}</h3><HealthBadge value={operation?.health ?? "never_run"} /></div><p>{workflow.instructions.split(/\n\s*\n/, 1)[0]}</p><footer><span>{workflow.skill ? `${workflow.skill.name}@${workflow.skill.version}` : workflow.executorType} · v{workflow.revisionNumber}</span><span>{operation?.nextRunAt ? `下次 ${formatDate(operation.nextRunAt)}` : "尚未定时"}</span></footer></div></Link>;
        })}</div>}
      </section>
      <ScheduleSection schedules={schedules.data ?? []} workflows={workflows} editingId={editingScheduleId} pending={actionPending} error={actionError} onEdit={setEditingScheduleId} onUpdate={(id, input) => updateSchedule.mutate({ id, input })} onAction={(id, verb) => action.mutate({ id, verb })} onRebind={(id, workSpecId) => rebind.mutate({ id, workSpecId })} />
    </>}
  </div>;
}

function OperationsPanel({ values }: { values: WorkflowOperationsSummary[] }) {
  const healthy = values.filter((item) => item.health === "healthy").length;
  const attention = values.filter((item) => item.health === "attention" || item.health === "degraded").length;
  const scheduled = values.filter((item) => item.enabledScheduleCount > 0).length;
  return <section className="operations-band panel"><div><small>工作流</small><strong>{values.length}</strong></div><div><small>运行正常</small><strong>{healthy}</strong></div><div><small>需要处理</small><strong>{attention}</strong></div><div><small>定时已启用</small><strong>{scheduled}</strong></div></section>;
}

function PreflightPanel({ value }: { value: WorkSpecPreflight }) {
  return <section className={`preflight-panel panel ${value.ready ? "ready" : "blocked"}`}><div className="section-heading"><div><h2>{value.ready ? "可以运行" : "暂时不能运行"}</h2><p>检查时间 {formatDate(value.checkedAt)}。警告不会阻止运行，失败项会阻止换绑或执行。</p></div>{value.ready ? <CheckCircleIcon size={28} weight="fill" /> : <WarningCircleIcon size={28} weight="fill" />}</div><div className="preflight-checks">{value.checks.map((check) => <div key={check.code}><Status value={check.status} /><span><strong>{check.label}</strong><small>{check.detail}</small></span></div>)}</div></section>;
}

function RadarDetail({ workflow, workflows, schedules, runs, artifacts, editingScheduleId, pending, error, onEdit, onUpdate, onAction, onRebind }: { workflow: WorkSpec; workflows: WorkSpec[]; schedules: Schedule[]; runs: Run[]; artifacts: Artifact[]; editingScheduleId: string | null; pending: boolean; error: unknown; onEdit(id: string | null): void; onUpdate(id: string, input: unknown): void; onAction(id: string, verb: string): void; onRebind(id: string, workSpecId: string): void }) {
  return <div className="radar-workspace"><section className="skill-lock panel"><div><LockKeyIcon weight="duotone" /><span><small>{workflow.skill ? `${workflow.skill.name}@${workflow.skill.version}` : "未绑定仓库 Skill"} · 版本 {workflow.revisionNumber}</small><strong>{workflow.skill?.contentHash ?? workflow.id}</strong></span></div><Status value={workflow.lifecycleStatus} /><p>{workflow.revisionOfWorkSpecId ? `由 ${workflow.revisionOfWorkSpecId.slice(0, 8)} 创建的新版本。` : "这是版本链的起点。"} Schedule 只绑定当前 ID，不会跟随仓库文件静默变化。</p></section>
    {(workflow.executorType === "codex" || workflow.executorType === "openworker") && workflow.skill && <PromotionPanel key={workflow.id} workflow={workflow} schedules={schedules} runs={runs} />}
    <div className="radar-detail-grid"><section className="panel definition-panel"><div className="section-heading"><div><h2>执行快照</h2><p>Runtime 每次都会收到这份固定内容。</p></div></div><dl><div><dt><TerminalWindowIcon /> Runtime</dt><dd>{workflow.executorType}</dd></div><div><dt><FingerprintIcon /> 版本</dt><dd>v{workflow.revisionNumber}</dd></div><div><dt>超时</dt><dd>{workflow.timeoutSeconds} 秒</dd></div><div><dt>最大尝试</dt><dd>{workflow.maxAttempts} 次</dd></div><div><dt>结果沉淀</dt><dd>{workflow.resultDeposition ? `${[workflow.resultDeposition.directory, workflow.resultDeposition.subdirectory].filter(Boolean).join("/")}，${workflow.resultDeposition.trigger === "on_success" ? "成功后自动写入" : "验收后写入"}` : "仅保留运行记录"}</dd></div></dl><h3>执行要求</h3><pre>{workflow.instructions}</pre><h3>固定输入</h3><pre>{JSON.stringify(workflow.input, null, 2)}</pre></section>
      <section className="panel"><div className="section-heading"><div><h2>最近运行</h2><p>自动重试也会生成新的尝试记录。</p></div><Link href="/runs">打开运行中心</Link></div><div className="entity-stack">{runs.slice(0, 8).map((run) => <Link href={`/runs/${run.id}`} key={run.id}><span><strong>{run.runMode === "rehearsal" ? "预执行" : run.runMode === "failure_drill" ? "失败演练" : `尝试 ${run.attempt}`}</strong><small>{formatDate(run.createdAt)} · {run.executorType}</small></span><Status value={run.status} /></Link>)}{runs.length === 0 && <p className="quiet">这个版本还没有运行记录。</p>}</div></section>
      <section className="panel"><div className="section-heading"><div><h2>成果</h2><p>报告、代码和文件都能追溯到运行。</p></div></div><div className="entity-stack">{artifacts.slice(0, 8).map((artifact) => <Link href={`/assets/artifacts/${artifact.id}`} key={artifact.id}><span><strong>{artifact.name}</strong><small>{artifact.uri}</small></span><ArchiveBoxIcon /></Link>)}{artifacts.length === 0 && <p className="quiet">这个版本还没有登记成果。</p>}</div></section>
    </div>
    {workflow.kind === "workflow" && <ScheduleSection schedules={schedules} workflows={workflows} editingId={editingScheduleId} pending={pending} error={error} onEdit={onEdit} onUpdate={onUpdate} onAction={onAction} onRebind={onRebind} />}
  </div>;
}

function PromotionPanel({ workflow, schedules, runs }: { workflow: WorkSpec; schedules: Schedule[]; runs: Run[] }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<SkillDraftInput>(() => skillDraft(workflow.skill));
  const [lastStarted, setLastStarted] = useState<Run | null>(null);
  const gate = useQuery({ queryKey: ["promotion", workflow.id], queryFn: () => api<RehearsalPromotionGate>(`/work-specs/${workflow.id}/promotion`) });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["promotion", workflow.id] });
    void client.invalidateQueries({ queryKey: ["runs"] });
    void client.invalidateQueries({ queryKey: ["work-specs"] });
    void client.invalidateQueries({ queryKey: ["skills"] });
    void client.invalidateQueries({ queryKey: ["schedules"] });
  };
  const rehearsal = useMutation({ mutationFn: () => post<Run>(`/work-specs/${workflow.id}/rehearsals`), onSuccess: (run) => { setLastStarted(run); refresh(); } });
  const evaluate = useMutation({ mutationFn: (runId: string) => post(`/runs/${runId}/evaluation`, { note: "由本地用户从雷达工作区发起确定性评估。" }), onSuccess: refresh });
  const drill = useMutation({ mutationFn: () => post(`/work-specs/${workflow.id}/failure-drills`), onSuccess: refresh });
  const candidate = useMutation({ mutationFn: () => post<SkillCandidate>(`/work-specs/${workflow.id}/skill-candidates`, draft), onSuccess: refresh });
  const publish = useMutation({ mutationFn: (id: string) => post<SkillCandidate>(`/skill-candidates/${id}/publish`), onSuccess: refresh });
  const rebindCandidate = useMutation({ mutationFn: ({ scheduleId, workSpecId }: { scheduleId: string; workSpecId: string }) => post<Schedule>(`/schedules/${scheduleId}/rebind`, { workSpecId }), onSuccess: refresh });
  if (gate.isLoading) return <section className="promotion-panel panel"><LoadingBlock /></section>;
  if (gate.error || !gate.data) return <section className="promotion-panel panel"><ErrorBlock error={gate.error ?? new Error("晋级状态不可用")} /></section>;
  const value = gate.data;
  const evaluated = new Set(value.evaluations.map((item) => item.runId));
  const evaluable = runs.filter((run) => run.runMode === "rehearsal" && ["succeeded", "partially_succeeded", "failed", "cancelled"].includes(run.status) && !evaluated.has(run.id));
  const activeCandidate = value.candidates.find((item) => item.status === "pending") ?? value.candidates[0] ?? null;
  const publishedWorkSpecId = value.candidates.find((item) => item.status === "published")?.publishedWorkSpecId ?? null;
  const operationError = rehearsal.error ?? evaluate.error ?? drill.error ?? candidate.error ?? publish.error ?? rebindCandidate.error;
  const updateDraft = <K extends keyof SkillDraftInput>(key: K, value: SkillDraftInput[K]) => setDraft((before) => ({ ...before, [key]: value }));
  return <section className="promotion-panel panel"><div className="section-heading"><div><small className="eyebrow">验证晋级</small><h2>{value.ready ? "证据齐全，可以生成候选 Skill" : "先把流程真实跑通"}</h2><p>两个独立预执行根加一次失败演练。重试只算同一次，预执行不会写 Obsidian，也不会改定时。</p></div><Status value={value.ready ? "ready" : "attention"} /></div>
    <div className="operations-band promotion-metrics"><div><small>通过的独立预执行</small><strong>{value.passedRehearsalRoots.length}/2</strong></div><div><small>通过的失败演练</small><strong>{value.passedFailureDrillRunIds.length}/1</strong></div><div><small>晋级状态</small><strong>{value.ready ? "可晋级" : "未满足"}</strong></div></div>
    {value.missing.length > 0 && <div className="attention-note">{value.missing.map((item) => <span key={item}><WarningCircleIcon /> {item}</span>)}</div>}
    <div className="row-actions"><button className="button secondary" disabled={rehearsal.isPending} onClick={() => rehearsal.mutate()}><PlayIcon /> {rehearsal.isPending ? "正在创建" : "开始一次真实预执行"}</button><button className="button secondary" disabled={drill.isPending || value.passedFailureDrillRunIds.length > 0} onClick={() => drill.mutate()}><FlaskIcon /> {drill.isPending ? "正在演练" : "运行结构失败演练"}</button></div>
    {lastStarted && <p className="success-note">预执行已创建：<Link href={`/runs/${lastStarted.id}`}>查看 Run {lastStarted.id.slice(0, 8)}</Link>。完成后回到这里执行评估。</p>}
    {evaluable.length > 0 && <div className="entity-stack promotion-evidence">{evaluable.map((run) => <div key={run.id}><span><strong>待评估的预执行</strong><small>{run.id.slice(0, 8)} · {formatDate(run.createdAt)} · {run.status}</small></span><button className="button secondary small" disabled={evaluate.isPending} onClick={() => evaluate.mutate(run.id)}>评估证据</button></div>)}</div>}
    {value.evaluations.length > 0 && <div className="entity-stack promotion-evidence">{value.evaluations.map((item) => <Link href={`/runs/${item.runId}`} key={item.id}><span><strong>{item.runMode === "failure_drill" ? "失败演练" : "预执行"} · {item.passed ? "通过" : "未通过"}</strong><small>{item.checks.filter((check) => check.passed).length}/{item.checks.length} 项 · 根 {item.rehearsalRootRunId.slice(0, 8)}</small></span><Status value={item.passed ? "pass" : "fail"} /></Link>)}</div>}
    <div className="promotion-candidate"><div className="section-heading"><div><h3>候选 Skill</h3><p>候选只存数据库。你点击“人工发布”后才会写入仓库，并创建新的 WorkSpec 版本。</p></div></div>
      <div className="form-grid"><Field label="机器名称"><input aria-label="晋级 Skill 机器名称" value={draft.name} onChange={(event) => { const name = event.target.value; setDraft((before) => ({ ...before, name, expectedCurrentHash: name === workflow.skill?.name ? workflow.skill.contentHash : null })); }} /></Field><Field label="版本"><input aria-label="晋级 Skill 版本" value={draft.version} onChange={(event) => updateDraft("version", event.target.value)} /></Field><Field label="显示名称"><input aria-label="晋级 Skill 显示名称" value={draft.displayName} onChange={(event) => updateDraft("displayName", event.target.value)} /></Field><Field label="用途说明"><input aria-label="晋级 Skill 用途说明" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></Field></div><Field label="固定执行方法"><textarea aria-label="晋级 Skill 执行方法" rows={9} value={draft.instructions} onChange={(event) => updateDraft("instructions", event.target.value)} /></Field>
      <button className="button secondary" disabled={!value.ready || candidate.isPending || activeCandidate?.status === "pending"} onClick={() => candidate.mutate()}>{candidate.isPending ? "正在保存" : "保存数据库候选"}</button>
      {activeCandidate && <div className={`skill-validation ${activeCandidate.status === "published" ? "ready" : "attention"}`}><strong>{activeCandidate.status === "published" ? "已人工发布" : "待人工发布"} · {activeCandidate.draft.name}@{activeCandidate.draft.version}</strong><code>{activeCandidate.contentHash}</code><p>证据 Run：{activeCandidate.evidenceRunIds.map((id) => id.slice(0, 8)).join("、")}</p><details><summary>查看将要写入的完整 Skill</summary><pre>{activeCandidate.content}</pre></details>{activeCandidate.status === "pending" && <button className="button primary" disabled={publish.isPending} onClick={() => publish.mutate(activeCandidate.id)}>{publish.isPending ? "正在发布" : "人工发布并创建新版"}</button>}</div>}
      {publishedWorkSpecId && <div className="attention-note"><strong>发布没有自动改定时。</strong>{schedules.length === 0 ? <span>当前版本没有定时规则；你可以打开新版后单独添加。</span> : schedules.map((schedule) => <span key={schedule.id}>{schedule.name} 仍绑定旧版。<button className="button secondary small" disabled={rebindCandidate.isPending || schedule.workSpecId === publishedWorkSpecId} onClick={() => rebindCandidate.mutate({ scheduleId: schedule.id, workSpecId: publishedWorkSpecId })}>明确换绑到新版</button></span>)}</div>}
    </div>
    {Boolean(operationError) && <p className="form-error">{errorMessage(operationError, "验证晋级操作失败")}</p>}
  </section>;
}

function ScheduleSection({ schedules, workflows, editingId, pending, error, onEdit, onUpdate, onAction, onRebind }: { schedules: Schedule[]; workflows: WorkSpec[]; editingId: string | null; pending: boolean; error: unknown; onEdit(id: string | null): void; onUpdate(id: string, input: unknown): void; onAction(id: string, verb: string): void; onRebind(id: string, workSpecId: string): void }) {
  return <section className="panel"><div className="section-heading"><div><h2>定时执行</h2><p>改时间不会改版本；换版本必须明确点击“确认换绑”。</p></div></div>
    <div className="schedule-table">{schedules.map((schedule) => editingId === schedule.id ? <ScheduleEditForm key={schedule.id} schedule={schedule} pending={pending} error={error} onCancel={() => onEdit(null)} onSubmit={(input) => onUpdate(schedule.id, input)} /> : <ScheduleRow key={schedule.id} schedule={schedule} workflows={workflows} pending={pending} onEdit={() => onEdit(schedule.id)} onAction={(verb) => onAction(schedule.id, verb)} onRebind={(workSpecId) => onRebind(schedule.id, workSpecId)} />)}{schedules.length === 0 && <p className="quiet">还没有定时规则。</p>}</div>{Boolean(error) && !editingId && <p className="form-error">{errorMessage(error, "定时操作失败")}</p>}
  </section>;
}

function ScheduleRow({ schedule, workflows, pending, onEdit, onAction, onRebind }: { schedule: Schedule; workflows: WorkSpec[]; pending: boolean; onEdit(): void; onAction(verb: string): void; onRebind(workSpecId: string): void }) {
  const [target, setTarget] = useState(schedule.workSpecId);
  const current = workflows.find((item) => item.id === schedule.workSpecId);
  return <div className="schedule-row"><div><strong>{schedule.name}</strong><small>{schedule.cronExpression} · {schedule.timezone}{schedule.catchUp ? " · 补跑一次" : " · 不补跑"}</small><small>当前：{current?.title ?? schedule.workSpecId.slice(0, 8)} · v{current?.revisionNumber ?? "?"}</small></div><div><span>下次 {formatDate(schedule.nextRunAt)}</span><Status value={schedule.enabled ? "active" : "paused"} /></div><div className="schedule-actions"><div className="rebind-control"><select aria-label={`换绑 ${schedule.name}`} value={target} onChange={(event) => setTarget(event.target.value)}>{workflows.map((item) => <option key={item.id} value={item.id}>{item.title} · v{item.revisionNumber}</option>)}</select><button className="button secondary small" disabled={pending || target === schedule.workSpecId} onClick={() => onRebind(target)}>确认换绑</button></div><div className="row-actions"><button className="icon-button" title="修改定时" aria-label={`修改 ${schedule.name}`} onClick={onEdit}><SlidersHorizontalIcon /></button><button className="icon-button" title={schedule.enabled ? "暂停" : "恢复"} aria-label={`${schedule.enabled ? "暂停" : "恢复"} ${schedule.name}`} onClick={() => onAction(schedule.enabled ? "pause" : "resume")}>{schedule.enabled ? <PauseIcon /> : <PlayIcon />}</button><button className="button secondary small" onClick={() => onAction("run-now")}>立即运行</button></div></div></div>;
}

function ScheduleEditForm({ schedule, pending, error, onCancel, onSubmit }: { schedule: Schedule; pending: boolean; error: unknown; onCancel(): void; onSubmit(input: unknown): void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: data.get("name"), cronExpression: data.get("cronExpression"), timezone: data.get("timezone"), catchUp: data.get("catchUp") === "on", enabled: data.get("enabled") === "on" }); };
  return <form className="schedule-edit" onSubmit={submit}><div className="form-grid"><Field label="名称"><input name="name" defaultValue={schedule.name} required /></Field><Field label="Cron"><input name="cronExpression" defaultValue={schedule.cronExpression} required /></Field><Field label="时区"><input name="timezone" defaultValue={schedule.timezone} required /></Field><Field label="运行策略"><label className="check-field"><input type="checkbox" name="catchUp" defaultChecked={schedule.catchUp} /> 错过后补跑一次</label><label className="check-field"><input type="checkbox" name="enabled" defaultChecked={schedule.enabled} /> 启用定时</label></Field></div>{Boolean(error) && <p className="form-error">{errorMessage(error, "保存定时失败")}</p>}<div className="row-actions"><button className="button primary small" disabled={pending}>{pending ? "正在保存" : "保存修改"}</button><button className="button secondary small" type="button" onClick={onCancel}>取消</button></div></form>;
}

function WorkflowForm({ projects, skills, vaults, initial, revision = false, pending, error, onSubmit }: { projects: Project[]; skills: SkillSnapshot[]; vaults: KnowledgeVault[]; initial?: WorkSpec; revision?: boolean; pending: boolean; error: unknown; onSubmit(input: unknown): void }) {
  const [runtime, setRuntime] = useState<string>(initial?.executorType ?? "internal");
  const [deposit, setDeposit] = useState(Boolean(initial?.resultDeposition));
  const [depositionTrigger, setDepositionTrigger] = useState(initial?.resultDeposition?.trigger ?? "on_acceptance");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const input = workflowRuntimeInput(runtime, data); const skill = skills.find((item) => item.name === data.get("skillName")) ?? null; onSubmit({ kind: "workflow", title: data.get("title"), instructions: data.get("instructions"), executorType: runtime, input, timeoutSeconds: Number(data.get("timeoutSeconds")), maxAttempts: Number(data.get("maxAttempts")), lifecycleStatus: "active", projectId: data.get("projectId") || null, skill, reviewPolicy: deposit && depositionTrigger === "on_success" ? "not_required" : "required", resultDeposition: deposit ? { vaultId: data.get("depositionVaultId"), directory: data.get("depositionDirectory"), subdirectory: data.get("depositionSubdirectory") || "", titleTemplate: data.get("depositionTitleTemplate"), trigger: depositionTrigger, period: data.get("depositionPeriod"), timezone: data.get("depositionTimezone") } : null }); };
  const choices = runtime === "codex" ? projects.filter((item) => item.repositoryPath) : projects;
  const initialInput = objectRecord(initial?.input);
  const initialRuntime = objectRecord(initialInput.runtime);
  const agentRuntime = runtime === "codex" || runtime === "openworker";
  return <form className="editor-panel" onSubmit={submit}><div className="section-heading"><div><h2>{revision ? "创建工作流新版" : "新建工作流"}</h2><p>{revision ? "会生成新的 WorkSpec ID；旧版本和历史运行保持不变。" : "保存后形成不可变版本。"}</p></div></div><div className="form-grid"><Field label="名称"><input name="title" defaultValue={initial?.title} required autoFocus /></Field><Field label="Runtime"><select value={runtime} onChange={(event) => { setRuntime(event.target.value); if (event.target.value !== "codex" && event.target.value !== "openworker") setDepositionTrigger("on_acceptance"); }}><option value="internal">Internal</option><option value="process">本地 Python / Node</option><option value="codex">Codex</option><option value="openworker">OpenWorker</option></select></Field><Field label="固定 Skill" hint="会把版本、全文与 SHA-256 一并保存。"><select name="skillName" defaultValue={initial?.skill?.name ?? ""} required={agentRuntime}><option value="">{agentRuntime ? "请选择 Skill" : "不绑定 Skill"}</option>{skills.map((item) => <option value={item.name} key={item.name}>{item.name}@{item.version} · {item.contentHash.slice(0, 10)}</option>)}</select></Field><Field label="所属项目"><select name="projectId" defaultValue={initial?.projectId ?? ""} required={runtime === "codex"}><option value="">{runtime === "codex" ? "请选择 Git 项目" : "不绑定项目"}</option>{choices.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field><Field label="执行要求"><textarea name="instructions" defaultValue={initial?.instructions} required rows={4} /></Field><Field label="单次超时（秒）"><input name="timeoutSeconds" type="number" min="1" max="86400" defaultValue={initial?.timeoutSeconds ?? 1800} required /></Field><Field label="最大尝试"><input name="maxAttempts" type="number" min="1" max="10" defaultValue={initial?.maxAttempts ?? 3} required /></Field>{runtime === "internal" ? <Field label="输出消息"><input name="message" defaultValue={String(initialInput.message ?? "执行完成")} /></Field> : runtime === "process" ? <><Field label="命令"><select name="command" defaultValue={String(initialInput.command ?? "python3")}><option value="python3">python3</option><option value="node">node</option></select></Field><Field label="参数"><input name="args" defaultValue={Array.isArray(initialInput.args) ? initialInput.args.join(" ") : ""} /></Field><Field label="工作目录"><input name="cwd" defaultValue={String(initialInput.cwd ?? "")} required /></Field></> : runtime === "codex" ? <><Field label="文件权限"><select name="sandboxMode" defaultValue={String(initialRuntime.sandboxMode ?? "read-only")}><option value="read-only">只读</option><option value="workspace-write">允许修改项目</option></select></Field><Field label="联网能力"><label className="check-field"><input type="checkbox" name="networkAccess" defaultChecked={initialRuntime.networkAccess === true} /> 允许网络与网页搜索</label></Field></> : <Field label="OpenWorker Agent"><select name="agent" defaultValue={String(initialRuntime.agent ?? "cowork")}><option value="cowork">Cowork</option><option value="code">Code</option></select></Field>}<Field label="结果沉淀" hint="低风险只读日报可成功后自动写入，其他工作验收后写入。"><label className="check-field"><input type="checkbox" checked={deposit} disabled={vaults.length === 0} onChange={(event) => setDeposit(event.target.checked)} /> 写入 Obsidian 报告</label>{vaults.length === 0 && <small>请先在“资产 - 知识”登记 Vault。</small>}</Field>{deposit && <><Field label="写入时机"><select name="depositionTrigger" value={depositionTrigger} onChange={(event) => setDepositionTrigger(event.target.value as "on_acceptance" | "on_success")}><option value="on_acceptance">人工验收后写入</option><option value="on_success" disabled={!agentRuntime}>成功后自动写入</option></select>{depositionTrigger === "on_success" && <small>仅适用于绑定固定 Skill 的 Codex 或 OpenWorker 只读报告。</small>}</Field><Field label="目标 Vault"><select name="depositionVaultId" defaultValue={initial?.resultDeposition?.vaultId ?? vaults[0]?.id} required>{vaults.map((vault) => <option value={vault.id} key={vault.id}>{vault.name}</option>)}</select></Field><Field label="托管根目录"><select name="depositionDirectory" defaultValue={initial?.resultDeposition?.directory ?? "Reports"}><option value="Reports">Reports</option><option value="Generated">Generated</option></select></Field><Field label="子目录" hint="例如 AI日报 或 机会雷达，不允许跳出托管目录。"><input name="depositionSubdirectory" defaultValue={initial?.resultDeposition?.subdirectory ?? ""} /></Field><Field label="去重周期"><select name="depositionPeriod" defaultValue={initial?.resultDeposition?.period ?? (depositionTrigger === "on_success" ? "calendar_day" : "run")}><option value="calendar_day">同一天只保留一份</option><option value="run">每次运行一份</option></select></Field><Field label="日报时区"><input name="depositionTimezone" defaultValue={initial?.resultDeposition?.timezone ?? "Asia/Tokyo"} required /></Field><Field label="笔记标题模板" hint="支持 {title}、{date} 和 {runId}。"><input name="depositionTitleTemplate" defaultValue={initial?.resultDeposition?.titleTemplate ?? "{date} {title}"} required /></Field></>}</div><p className="form-note"><LockKeyIcon /> 新版保存后，请在定时规则中明确选择并确认换绑。</p>{Boolean(error) && <p className="form-error">{errorMessage(error, "保存失败")}</p>}<button className="button primary" disabled={pending || (runtime === "codex" && choices.length === 0) || (agentRuntime && skills.length === 0) || (deposit && vaults.length === 0)}>{pending ? "正在保存" : revision ? "保存为新版本" : "保存固定版本"}</button></form>;
}

function SkillStudio({ skills, onClose }: { skills: SkillSnapshot[]; onClose(): void }) {
  const [selectedName, setSelectedName] = useState("");
  const selected = skills.find((item) => item.name === selectedName) ?? null;
  return <section className="skill-studio panel"><div className="section-heading"><div><h2>Skill 工作台</h2><p>先检查，再发布。发布只写入当前仓库的 .agents/skills。</p></div><button className="button secondary small" onClick={onClose}>收起</button></div><Field label="选择已有 Skill"><select value={selectedName} onChange={(event) => setSelectedName(event.target.value)}><option value="">新建 Skill</option>{skills.map((skill) => <option value={skill.name} key={skill.name}>{skill.name}@{skill.version}</option>)}</select></Field><SkillDraftEditor key={selected?.contentHash ?? "new"} current={selected} /></section>;
}

function SkillDraftEditor({ current }: { current: SkillSnapshot | null }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<SkillDraftInput>(() => skillDraft(current));
  const [validation, setValidation] = useState<SkillDraftValidation | null>(null);
  const validate = useMutation({ mutationFn: (input: SkillDraftInput) => post<SkillDraftValidation>("/skills/validate", input), onSuccess: setValidation });
  const publish = useMutation({ mutationFn: () => post<SkillSnapshot>("/skills/publish", { ...draft, validatedContentHash: validation!.candidate.contentHash }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["skills"] }); setValidation(null); } });
  const update = <K extends keyof SkillDraftInput>(key: K, value: SkillDraftInput[K]) => { setDraft((valueBefore) => ({ ...valueBefore, [key]: value })); setValidation(null); validate.reset(); publish.reset(); };
  return <div className="skill-draft"><div className="form-grid"><Field label="机器名称" hint="只能用小写字母、数字和短横线。"><input aria-label="Skill 机器名称" value={draft.name} disabled={Boolean(current)} onChange={(event) => update("name", event.target.value)} /></Field><Field label="新版本"><input aria-label="Skill 新版本" value={draft.version} onChange={(event) => update("version", event.target.value)} /></Field><Field label="显示名称"><input aria-label="Skill 显示名称" value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} /></Field><Field label="用途说明"><input aria-label="Skill 用途说明" value={draft.description} onChange={(event) => update("description", event.target.value)} /></Field></div><Field label="执行方法" hint="写清步骤、输入、输出、门禁和完成标准。"><textarea aria-label="Skill 执行方法" rows={12} value={draft.instructions} onChange={(event) => update("instructions", event.target.value)} /></Field>{validation && <div className={`skill-validation ${validation.valid ? "ready" : "blocked"}`}><strong>{validation.valid ? "检查通过，可以发布" : "检查未通过"}</strong><code>{validation.candidate.contentHash}</code>{validation.issues.map((issue) => <p key={issue.code}>{issue.level === "error" ? "错误" : "提醒"}：{issue.message}</p>)}</div>}{publish.data && <p className="success-note">已发布 {publish.data.name}@{publish.data.version}。现在可以用它创建工作流。</p>}{Boolean(validate.error ?? publish.error) && <p className="form-error">{errorMessage(validate.error ?? publish.error, "Skill 操作失败")}</p>}<div className="row-actions"><button className="button secondary" disabled={validate.isPending || publish.isPending} onClick={() => validate.mutate(draft)}>{validate.isPending ? "正在检查" : "检查 Skill"}</button><button className="button primary" disabled={!validation?.valid || publish.isPending} onClick={() => publish.mutate()}>{publish.isPending ? "正在发布" : "发布这个版本"}</button></div></div>;
}

function workflowRuntimeInput(runtime: string, data: FormData): unknown {
  if (runtime === "internal") return { operation: "echo", message: data.get("message") ?? "执行完成", delayMs: 0 };
  if (runtime === "process") return { command: data.get("command"), args: String(data.get("args") ?? "").split(" ").filter(Boolean), cwd: data.get("cwd") };
  if (runtime === "codex") { const networkAccess = data.get("networkAccess") === "on"; return { runtime: { sandboxMode: data.get("sandboxMode") || "read-only", networkAccess, webSearch: networkAccess } }; }
  return { runtime: { agent: data.get("agent") || "cowork" } };
}

function ScheduleForm({ workflows, selectedWorkSpecId, pending, error, onSubmit }: { workflows: WorkSpec[]; selectedWorkSpecId?: string; pending: boolean; error: unknown; onSubmit(input: unknown): void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ workSpecId: data.get("workSpecId"), name: data.get("name"), cronExpression: data.get("cronExpression"), timezone: data.get("timezone"), enabled: true, catchUp: data.get("catchUp") === "on" }); };
  return <form className="editor-panel" onSubmit={submit}><div className="form-grid"><Field label="固定工作流版本"><select name="workSpecId" defaultValue={selectedWorkSpecId} required>{workflows.map((item) => <option key={item.id} value={item.id}>{item.title} · v{item.revisionNumber}</option>)}</select></Field><Field label="定时名称"><input name="name" required /></Field><Field label="Cron 表达式"><input name="cronExpression" defaultValue="0 8 * * *" required /></Field><Field label="时区"><input name="timezone" defaultValue="Asia/Tokyo" required /></Field><Field label="错过触发"><label className="check-field"><input type="checkbox" name="catchUp" /> 恢复后最多补跑一次</label></Field></div>{Boolean(error) && <p className="form-error">{errorMessage(error, "保存失败")}</p>}<button className="button primary" disabled={pending || workflows.length === 0}>{pending ? "正在保存" : "保存定时"}</button></form>;
}

function HealthBadge({ value }: { value: WorkflowOperationsSummary["health"] }) {
  const labels = { healthy: "正常", degraded: "连续失败", attention: "处理中", never_run: "未运行", paused: "已暂停" };
  return <span className={`health-badge ${value}`}>{labels[value]}</span>;
}

function skillDraft(current: SkillSnapshot | null): SkillDraftInput {
  if (!current) return { name: "", version: "1.0.0", displayName: "", description: "", instructions: "# 工作方法\n\n## 步骤\n\n1. 读取本次运行上下文。\n2. 完成任务并验证结果。\n3. 提交结构化结果。", expectedCurrentHash: null };
  const rawDescription = /^description:\s*(.+)$/m.exec(current.content)?.[1]?.trim() ?? current.name;
  const description = rawDescription.startsWith('"') ? parseJsonString(rawDescription) : rawDescription;
  const instructions = current.content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
  const displayName = /^#\s+(.+)$/m.exec(instructions)?.[1]?.trim() ?? current.name;
  return { name: current.name, version: bumpPatch(current.version), displayName, description, instructions, expectedCurrentHash: current.contentHash };
}

function bumpPatch(version: string): string {
  const [major = 1, minor = 0, patch = 0] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function objectRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function parseJsonString(value: string): string { try { const parsed: unknown = JSON.parse(value); return typeof parsed === "string" ? parsed : value; } catch { return value; } }
