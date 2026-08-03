import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, BookOpenTextIcon, CalculatorIcon, CheckCircleIcon, FileTextIcon, FolderSimpleIcon, LinkSimpleIcon, MagnifyingGlassIcon, NotePencilIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import type { Artifact, KnowledgeDocument, KnowledgeDocumentDetail, KnowledgeIndexResult, KnowledgeLinkInput, KnowledgeVault, KnowledgeWatchHealth, Project, Run, WorkSpec } from "@personal-os/vnext-contracts";
import { api, post } from "../api";
import { EmptyBlock, ErrorBlock, Field, LoadingBlock, PageHeader, errorMessage, formatDate } from "../components";
import { FinancePanel } from "./FinancePanel";
import { Link, useLocation } from "wouter";

export function AssetsPage({ initialTab = "artifacts", selectedId }: { initialTab?: "artifacts" | "knowledge" | "finance"; selectedId?: string } = {}) {
  return <div className="page-stack"><PageHeader title="资产" description="知识、生成物和经营数据都从工作结果回流到这里。" /><div className="tabs" role="tablist"><Link href="/assets" role="tab" aria-selected={initialTab === "artifacts"}><FileTextIcon /> 成果</Link><Link href="/assets/knowledge" role="tab" aria-selected={initialTab === "knowledge"}><BookOpenTextIcon /> 知识</Link><Link href="/assets/finance" role="tab" aria-selected={initialTab === "finance"}><CalculatorIcon /> 财务</Link></div>{initialTab === "artifacts" ? <ArtifactPanel selectedId={selectedId} /> : initialTab === "knowledge" ? <KnowledgePanel initialSelectedId={selectedId} /> : <FinancePanel />}</div>;
}

function ArtifactPanel({ selectedId }: { selectedId?: string }) {
  const artifacts = useQuery({ queryKey: ["artifacts"], queryFn: () => api<Artifact[]>("/artifacts") });
  if (artifacts.isLoading) return <LoadingBlock label="正在读取成果索引" />;
  if (artifacts.error) return <ErrorBlock error={artifacts.error} />;
  if (selectedId) {
    const artifact = artifacts.data?.find((item) => item.id === selectedId);
    if (!artifact) return <EmptyBlock title="成果不存在" description="文件引用可能已归档，或链接来自旧系统。" action={<Link className="button secondary" href="/assets">返回成果</Link>} />;
    return <section className="panel artifact-detail"><div className="section-heading"><div><span className="eyebrow">可追踪成果</span><h2>{artifact.name}</h2><p>Personal OS 只保存引用和来源，不复制外部文件。</p></div><Link className="button secondary small" href="/assets"><ArrowLeftIcon /> 全部成果</Link></div><dl><div><dt>存储类型</dt><dd>{artifact.storageKind}</dd></div><div><dt>位置</dt><dd>{artifact.uri}</dd></div><div><dt>MIME</dt><dd>{artifact.mimeType || "未知"}</dd></div><div><dt>大小</dt><dd>{artifact.sizeBytes === null ? "未知" : `${artifact.sizeBytes.toLocaleString()} bytes`}</dd></div><div><dt>校验值</dt><dd>{artifact.checksum || "未提供"}</dd></div><div><dt>创建时间</dt><dd>{formatDate(artifact.createdAt)}</dd></div></dl><div className="artifact-relations">{artifact.projectId && <Link href={`/projects/${artifact.projectId}`}>查看所属项目</Link>}{artifact.workSpecId && <Link href={`/radar/${artifact.workSpecId}`}>查看执行定义</Link>}{artifact.runId && <Link href={`/runs/${artifact.runId}`}>查看来源 Run</Link>}</div></section>;
  }
  if (!artifacts.data?.length) return <EmptyBlock title="还没有成果" description="Runtime 生成报告、文档、代码或外部文件后，会把位置和来源登记在这里。" />;
  return <section className="panel main-panel"><div className="section-heading"><div><h2>全部成果</h2><p>文件保留在原位置，Personal OS 只保存可追踪引用。</p></div></div><div className="artifact-grid">{artifacts.data.map((artifact) => <Link href={`/assets/artifacts/${artifact.id}`} key={artifact.id}><div className="artifact-icon"><FileTextIcon weight="duotone" /></div><div><h3>{artifact.name}</h3><p>{artifact.uri}</p><footer><span>{artifact.storageKind}</span><time>{formatDate(artifact.createdAt)}</time></footer></div></Link>)}</div></section>;
}

function KnowledgePanel({ initialSelectedId }: { initialSelectedId?: string }) {
  const client = useQueryClient();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [showVaultForm, setShowVaultForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const vaults = useQuery({ queryKey: ["vaults"], queryFn: () => api<KnowledgeVault[]>("/knowledge/vaults") });
  const health = useQuery({ queryKey: ["knowledge-health"], queryFn: () => api<KnowledgeWatchHealth>("/knowledge/health"), refetchInterval: 15_000 });
  const results = useQuery({ queryKey: ["knowledge-search", query, tag], queryFn: () => api<KnowledgeDocument[]>(`/knowledge/search?q=${encodeURIComponent(query)}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`) });
  const detail = useQuery({ queryKey: ["knowledge-detail", selectedId], queryFn: () => api<KnowledgeDocumentDetail>(`/knowledge/documents/${selectedId}`), enabled: Boolean(selectedId) });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const specs = useQuery({ queryKey: ["work-specs"], queryFn: () => api<WorkSpec[]>("/work-specs") });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api<Run[]>("/runs") });
  const artifacts = useQuery({ queryKey: ["artifacts"], queryFn: () => api<Artifact[]>("/artifacts") });
  const createVault = useMutation({ mutationFn: (input: unknown) => post<KnowledgeVault>("/knowledge/vaults", input), onSuccess: () => { setShowVaultForm(false); void client.invalidateQueries({ queryKey: ["vaults"] }); void client.invalidateQueries({ queryKey: ["knowledge-health"] }); } });
  const createNote = useMutation({ mutationFn: (input: unknown) => post<KnowledgeDocumentDetail>("/knowledge/documents", input), onSuccess: (created) => { setShowNoteForm(false); setSelectedId(created.document.id); navigate(`/assets/knowledge/${created.document.id}`); void client.invalidateQueries({ queryKey: ["knowledge-search"] }); void client.invalidateQueries({ queryKey: ["knowledge-health"] }); } });
  const index = useMutation({ mutationFn: (id: string) => post<KnowledgeIndexResult>(`/knowledge/vaults/${id}/index`), onSuccess: () => { void client.invalidateQueries({ queryKey: ["knowledge-search"] }); void client.invalidateQueries({ queryKey: ["knowledge-detail"] }); void client.invalidateQueries({ queryKey: ["knowledge-health"] }); } });
  if (vaults.isLoading || results.isLoading) return <LoadingBlock label="正在读取知识索引" />;
  if (vaults.error || results.error) return <ErrorBlock error={vaults.error ?? results.error} />;
  const targets = [
    ...(projects.data ?? []).map((item) => ({ type: "project" as const, id: item.id, label: `项目 · ${item.name}` })),
    ...(specs.data ?? []).map((item) => ({ type: "work_spec" as const, id: item.id, label: `工作流 · ${item.title}` })),
    ...(runs.data ?? []).map((item) => ({ type: "run" as const, id: item.id, label: `运行 · ${item.id.slice(0, 8)} · ${item.status}` })),
    ...(artifacts.data ?? []).map((item) => ({ type: "artifact" as const, id: item.id, label: `成果 · ${item.name}` }))
  ];
  return <div className="knowledge-stack">
    <div className="knowledge-actions"><div><span className={`knowledge-health-dot ${health.data?.lastError ? "error" : ""}`} /><strong>{health.data?.lastError ? "监听异常" : "本地知识索引"}</strong><small>{health.data?.watchedVaults ?? 0} 个 Vault 正在监听{health.data?.lastIndexedAt ? ` · 最近索引 ${formatDate(health.data.lastIndexedAt)}` : ""}</small></div><button className="button primary" disabled={!vaults.data?.length} onClick={() => setShowNoteForm((value) => !value)}><NotePencilIcon /> 新建笔记</button></div>
    {showNoteForm && <KnowledgeNoteForm vaults={vaults.data ?? []} targets={targets} pending={createNote.isPending} error={createNote.error} onCancel={() => setShowNoteForm(false)} onSubmit={(input) => createNote.mutate(input)} />}
    {createNote.isSuccess && !showNoteForm && <p className="knowledge-success" role="status"><CheckCircleIcon weight="fill" /> 笔记已安全写入 Vault 并完成索引。</p>}
    <div className="knowledge-workspace"><aside className="panel asset-sidebar"><div className="section-heading"><div><h2>Obsidian Vault</h2><p>原文留在本地，系统保存索引和关系。</p></div><button className="icon-button" title="添加 Vault" aria-label="添加 Vault" onClick={() => setShowVaultForm((value) => !value)}><PlusIcon /></button></div>{showVaultForm && <VaultForm pending={createVault.isPending} error={createVault.error} onSubmit={(input) => createVault.mutate(input)} />}<div className="vault-list">{vaults.data?.map((vault) => <div key={vault.id}><span><FolderSimpleIcon /> {vault.name}</span><small>{vault.rootPath}</small><button className="button secondary small" disabled={index.isPending} onClick={() => index.mutate(vault.id)}>{index.isPending && index.variables === vault.id ? "正在索引" : "重新索引"}</button></div>)}{vaults.data?.length === 0 && <p className="quiet">还没有绑定 Vault。</p>}</div>{index.data && <p className="success-note">更新 {index.data.indexed} · 未变化 {index.data.unchanged} · 删除 {index.data.deleted} · 关系 {index.data.linked}{index.data.invalidLinks ? ` · 无效引用 ${index.data.invalidLinks}` : ""}</p>}{health.data?.lastError && <p className="form-error">{health.data.lastError}</p>}</aside>
      <section className="panel knowledge-index"><div className="search-box"><MagnifyingGlassIcon /><input aria-label="搜索 Obsidian" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文标题、正文或标签" /></div>{tag && <button className="filter-chip" onClick={() => setTag("")}>标签：{tag}<XIcon /></button>}{(results.data ?? []).length === 0 ? <EmptyBlock title={query || tag ? "没有匹配笔记" : "知识索引为空"} description={query || tag ? "换一个关键词或清除标签筛选。" : "添加 Vault 后，Markdown 会在这里形成可搜索索引。"} /> : <div className="knowledge-results">{results.data?.map((document) => <button type="button" className={selectedId === document.id ? "selected" : ""} key={document.id} onClick={() => { setSelectedId(document.id); navigate(`/assets/knowledge/${document.id}`); }}><div><h3>{document.title}</h3><time>{formatDate(document.modifiedAt)}</time></div><p>{document.snippet ? stripMarkup(document.snippet) : document.relativePath}</p><footer><span>{document.relativePath}</span><span>{document.tags.length ? `${document.tags.length} 个标签` : "无标签"}</span></footer></button>)}</div>}</section>
      <aside className="panel knowledge-detail">{!selectedId ? <EmptyBlock title="选择一篇笔记" description="打开笔记后可查看 frontmatter、标签和业务实体关系。" /> : detail.isLoading ? <LoadingBlock label="正在读取笔记关系" /> : detail.error ? <ErrorBlock error={detail.error} /> : detail.data ? <KnowledgeDetail detail={detail.data} onTag={setTag} /> : null}</aside>
    </div>
  </div>;
}

function KnowledgeDetail({ detail, onTag }: { detail: KnowledgeDocumentDetail; onTag(tag: string): void }) {
  return <div className="knowledge-detail-body"><header><span><BookOpenTextIcon weight="duotone" /> 知识详情</span><h2>{detail.document.title}</h2><p>{detail.vault.name} · {detail.document.relativePath}</p></header><section><h3>标签</h3><div className="tag-row">{detail.document.tags.map((tag) => <button key={tag} onClick={() => onTag(tag)}>{tag}</button>)}{detail.document.tags.length === 0 && <span className="quiet">没有标签</span>}</div></section><section><h3>业务关系</h3><div className="knowledge-links">{detail.links.map((link) => <div key={link.id}><LinkSimpleIcon /><span><strong>{entityLabel(link.entityType)}</strong><small>{link.entityId}</small></span><em>{relationLabel(link.relation)}</em></div>)}{detail.links.length === 0 && <p className="quiet">这篇笔记尚未关联项目、运行或成果。</p>}</div></section><section><h3>Frontmatter</h3><pre>{JSON.stringify(detail.document.frontmatter, null, 2)}</pre></section><footer><span>修改于 {formatDate(detail.document.modifiedAt)}</span><span>索引于 {formatDate(detail.document.indexedAt)}</span></footer></div>;
}

function KnowledgeNoteForm({ vaults, targets, pending, error, onCancel, onSubmit }: { vaults: KnowledgeVault[]; targets: Array<{ type: KnowledgeLinkInput["entityType"]; id: string; label: string }>; pending: boolean; error: unknown; onCancel(): void; onSubmit(input: unknown): void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const target = String(data.get("target") ?? "");
    const selected = targets.find((item) => `${item.type}:${item.id}` === target);
    onSubmit({ vaultId: data.get("vaultId"), directory: data.get("directory"), title: data.get("title"), body: data.get("body") ?? "", tags: String(data.get("tags") ?? "").split(/[,，]/).map((item) => item.trim()).filter(Boolean), links: selected ? [{ entityType: selected.type, entityId: selected.id, relation: data.get("relation") || "mentions" }] : [] });
  };
  return <form className="editor-panel knowledge-note-form" onSubmit={submit}><div className="section-heading"><div><h2>创建受控笔记</h2><p>只写入允许目录，不覆盖已有文件。保存后立即进入搜索索引。</p></div><button className="icon-button" type="button" aria-label="关闭新建笔记" onClick={onCancel}><XIcon /></button></div><div className="form-grid"><Field label="Vault"><select name="vaultId" required>{vaults.map((vault) => <option key={vault.id} value={vault.id}>{vault.name}</option>)}</select></Field><Field label="目录"><select name="directory"><option value="Inbox">Inbox · 待整理</option><option value="Generated">Generated · Agent 生成</option><option value="Reports">Reports · 正式报告</option></select></Field><Field label="标题"><input name="title" required maxLength={200} placeholder="例如：汽水音乐采榜复盘" /></Field><Field label="标签" hint="使用逗号分隔"><input name="tags" placeholder="音乐, 调研, 复盘" /></Field><Field label="关联业务对象"><select name="target"><option value="">暂不关联</option>{targets.map((target) => <option key={`${target.type}:${target.id}`} value={`${target.type}:${target.id}`}>{target.label}</option>)}</select></Field><Field label="关系"><select name="relation"><option value="mentions">提及</option><option value="documents">沉淀</option><option value="summarizes">总结</option><option value="supports">支撑</option></select></Field><div className="knowledge-body-field"><Field label="正文"><textarea name="body" rows={7} placeholder="记录结论、证据和下一步。" /></Field></div></div>{Boolean(error) && <p className="form-error">{errorMessage(error, "创建笔记失败")}</p>}<div className="row-actions"><button className="button primary" disabled={pending}>{pending ? "正在安全写入" : "创建并索引"}</button><button className="button secondary" type="button" onClick={onCancel}>取消</button></div></form>;
}

function VaultForm({ pending, error, onSubmit }: { pending: boolean; error: unknown; onSubmit(input: unknown): void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: data.get("name"), rootPath: data.get("rootPath") }); };
  return <form className="inline-form" onSubmit={submit}><Field label="名称"><input name="name" required /></Field><Field label="本地路径"><input name="rootPath" required placeholder="/Users/.../Vault" /></Field>{Boolean(error) && <p className="form-error">{errorMessage(error, "添加失败")}</p>}<button className="button primary small" disabled={pending}>{pending ? "正在添加" : "添加 Vault"}</button></form>;
}

function stripMarkup(value: string): string { return value.replace(/<\/?mark>/g, ""); }
function entityLabel(value: string): string { return ({ project: "项目", work_spec: "工作流", run: "运行", artifact: "成果" } as Record<string, string>)[value] ?? value; }
function relationLabel(value: string): string { return ({ mentions: "提及", documents: "沉淀", summarizes: "总结", supports: "支撑" } as Record<string, string>)[value] ?? value; }
