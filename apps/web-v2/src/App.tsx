import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, Theme } from "@radix-ui/themes";
import { ArchiveBoxIcon, BookOpenTextIcon, CirclesFourIcon, CrosshairSimpleIcon, FileTextIcon, FolderIcon, MagnifyingGlassIcon, MoonIcon, PulseIcon, SunIcon, TerminalWindowIcon, XIcon } from "@phosphor-icons/react";
import type { ControlPlaneSearchResult } from "@personal-os/vnext-contracts";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import { api } from "./api";
import { EmptyBlock, ErrorBlock, LoadingBlock, formatDate } from "./components";
import { TodayPage } from "./pages/TodayPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RadarPage } from "./pages/RadarPage";
import { RunsPage } from "./pages/RunsPage";
import { AssetsPage } from "./pages/AssetsPage";

type ThemeChoice = "system" | "light" | "dark";
const nav = [
  { href: "/", label: "今天", icon: CirclesFourIcon },
  { href: "/projects", label: "项目", icon: FolderIcon },
  { href: "/radar", label: "雷达", icon: CrosshairSimpleIcon },
  { href: "/runs", label: "运行", icon: PulseIcon },
  { href: "/assets", label: "资产", icon: ArchiveBoxIcon }
];

export function App() {
  const [theme, setTheme] = useState<ThemeChoice>(() => (localStorage.getItem("personal-os-v2-theme") as ThemeChoice | null) ?? "system");
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => { const media = window.matchMedia("(prefers-color-scheme: dark)"); const update = () => setSystemDark(media.matches); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  const appearance = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  useEffect(() => { document.documentElement.dataset.theme = appearance; localStorage.setItem("personal-os-v2-theme", theme); }, [appearance, theme]);
  return <Theme appearance={appearance} accentColor="orange" grayColor="sand" radius="medium" scaling="100%"><div className="app-shell"><Sidebar /><div className="app-column"><Topbar theme={theme} onTheme={() => setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system")} /><main className="page-container"><Switch>
    <Route path="/projects/:id">{({ id }) => <ProjectsPage selectedId={id} />}</Route><Route path="/projects">{() => <ProjectsPage />}</Route>
    <Route path="/radar/:id">{({ id }) => <RadarPage selectedId={id} />}</Route><Route path="/radar">{() => <RadarPage />}</Route>
    <Route path="/runs/:id">{({ id }) => <RunsPage selectedId={id} />}</Route><Route path="/runs">{() => <RunsPage />}</Route>
    <Route path="/assets/artifacts/:id">{({ id }) => <AssetsPage initialTab="artifacts" selectedId={id} />}</Route>
    <Route path="/assets/knowledge/:id">{({ id }) => <AssetsPage initialTab="knowledge" selectedId={id} />}</Route>
    <Route path="/assets/knowledge">{() => <AssetsPage initialTab="knowledge" />}</Route>
    <Route path="/assets/finance">{() => <AssetsPage initialTab="finance" />}</Route>
    <Route path="/assets">{() => <AssetsPage />}</Route>
    <Route path="/tasks">{() => <Redirect to="/runs" replace />}</Route><Route path="/review">{() => <Redirect to="/runs" replace />}</Route>
    <Route path="/" component={TodayPage} /><Route><TodayPage /></Route>
  </Switch></main></div><MobileNav /></div></Theme>;
}

function Sidebar() {
  return <aside className="sidebar"><Link href="/" className="brand" aria-label="Personal OS 首页"><span>PO</span><strong>Personal OS</strong></Link><nav>{nav.map((item) => <NavItem key={item.href} {...item} />)}</nav><div className="sidebar-foot"><span>LOCAL</span><p>你的数据留在本机</p></div></aside>;
}

function MobileNav() { return <nav className="mobile-nav">{nav.map((item) => <NavItem key={item.href} {...item} />)}</nav>; }

function NavItem({ href, label, icon: Icon }: typeof nav[number]) {
  const [location] = useLocation();
  const active = href === "/" ? location === "/" : location.startsWith(href);
  return <Link href={href} className={active ? "active" : ""}><Icon size={21} weight={active ? "fill" : "regular"} /><span>{label}</span></Link>;
}

function Topbar({ theme, onTheme }: { theme: ThemeChoice; onTheme(): void }) {
  const health = useQuery({ queryKey: ["health"], queryFn: () => api<{ status: string; pendingApprovals: number; scheduler: { status: string }; executors: Array<{ type: string; health: { available: boolean } }> }>("/health"), refetchInterval: 15_000 });
  const available = health.data?.executors.filter((item) => item.health.available).length ?? 0;
  const healthy = health.data?.status === "healthy" && health.data.scheduler.status === "healthy";
  return <header className="topbar"><div className="runtime-health"><span className={healthy ? "online" : "offline"} /><strong>{health.isError ? "API 离线" : healthy ? "本地运行" : "调度降级"}</strong><span>{available} 个执行器可用{health.data?.pendingApprovals ? ` · ${health.data.pendingApprovals} 项待审批` : ""}</span></div><div className="topbar-actions"><GlobalSearch /><button className="theme-button" onClick={onTheme} title={`主题：${theme}`}>{theme === "dark" ? <MoonIcon /> : <SunIcon />}<span>{theme === "system" ? "跟随系统" : theme === "dark" ? "深色" : "浅色"}</span></button></div></header>;
}

function GlobalSearch() {
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const normalized = query.trim();
  const search = useQuery({ queryKey: ["control-search", normalized], queryFn: () => api<ControlPlaneSearchResult[]>(`/search?q=${encodeURIComponent(normalized)}&limit=30`), enabled: open && normalized.length > 0, staleTime: 5_000 });
  const results = useMemo(() => search.data ?? [], [search.data]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); else { setQuery(""); setActive(0); } }, [open]);
  useEffect(() => { setActive(0); }, [normalized]);
  const choose = (result: ControlPlaneSearchResult) => { setOpen(false); navigate(searchRoute(result)); };
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger><button className="search-trigger" aria-label="打开统一搜索"><MagnifyingGlassIcon /><span>搜索</span><kbd>⌘ K</kbd></button></Dialog.Trigger><Dialog.Content className="command-dialog" maxWidth="760px" aria-describedby={undefined}>
    <Dialog.Title>搜索你的 Personal OS</Dialog.Title>
    <div className="command-input"><MagnifyingGlassIcon /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
      if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); }
    }} placeholder="项目、雷达、运行、成果或 Obsidian 知识" aria-label="统一搜索" /><Dialog.Close><button type="button" className="command-close" aria-label="关闭搜索"><XIcon /></button></Dialog.Close></div>
    <div className="command-results" role="listbox" aria-label="搜索结果">{!normalized ? <div className="command-hint"><span>跨五区定位一项真实记录</span><small>支持项目名、工作要求、Run ID、文件路径和中文笔记正文。</small></div> : search.isLoading ? <LoadingBlock label="正在搜索本地索引" /> : search.error ? <ErrorBlock error={search.error} /> : results.length === 0 ? <EmptyBlock title="没有匹配结果" description="换一个更短的关键词，或先在资产中索引 Obsidian Vault。" /> : results.map((result, index) => <button type="button" role="option" aria-selected={index === active} className={index === active ? "active" : ""} key={`${result.entityType}:${result.id}`} onMouseEnter={() => setActive(index)} onClick={() => choose(result)}><span className="command-result-icon">{searchIcon(result.entityType)}</span><span><strong>{result.title}</strong><small>{result.summary}</small></span><time>{entityLabel(result.entityType)} · {formatDate(result.updatedAt)}</time></button>)}</div>
  </Dialog.Content></Dialog.Root>;
}

function searchRoute(result: ControlPlaneSearchResult): string {
  if (result.entityType === "project") return `/projects/${result.id}`;
  if (result.entityType === "work_spec") return `/radar/${result.id}`;
  if (result.entityType === "run") return `/runs/${result.id}`;
  if (result.entityType === "artifact") return `/assets/artifacts/${result.id}`;
  return `/assets/knowledge/${result.id}`;
}
function entityLabel(value: ControlPlaneSearchResult["entityType"]): string { return ({ project: "项目", work_spec: "Skill", run: "运行", artifact: "成果", knowledge: "知识" } as const)[value]; }
function searchIcon(value: ControlPlaneSearchResult["entityType"]) { if (value === "project") return <FolderIcon />; if (value === "work_spec") return <CrosshairSimpleIcon />; if (value === "run") return <TerminalWindowIcon />; if (value === "artifact") return <FileTextIcon />; return <BookOpenTextIcon />; }
