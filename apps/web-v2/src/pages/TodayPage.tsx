import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { ArrowClockwiseIcon, ArrowRightIcon, BookOpenTextIcon, CheckCircleIcon, ChatCenteredTextIcon, ClockCountdownIcon, PulseIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import type { Approval, AuditLog, MonthlyFinanceSummary, Run, RunDeposition, Schedule, WorkflowOperationsSummary } from "@personal-os/vnext-contracts";
import { Link } from "wouter";
import { api } from "../api";
import { ErrorBlock, LoadingBlock, PageHeader, Status, formatDate, money } from "../components";

export function TodayPage() {
  const reduce = useReducedMotion();
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api<Run[]>("/runs"), refetchInterval: 4_000 });
  const schedules = useQuery({ queryKey: ["schedules"], queryFn: () => api<Schedule[]>("/schedules") });
  const month = currentMonth();
  const finance = useQuery({ queryKey: ["finance-monthly", month, "CNY"], queryFn: () => api<MonthlyFinanceSummary>(`/finance/summary/monthly?month=${month}&currency=CNY`) });
  const approvals = useQuery({ queryKey: ["approvals"], queryFn: () => api<Approval[]>("/approvals?status=pending"), refetchInterval: 4_000 });
  const failedDepositions = useQuery({ queryKey: ["depositions", "failed"], queryFn: () => api<RunDeposition[]>("/depositions?status=failed"), refetchInterval: 4_000 });
  const operations = useQuery({ queryKey: ["workflow-operations"], queryFn: () => api<WorkflowOperationsSummary[]>("/operations/workflows"), refetchInterval: 4_000 });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => api<AuditLog[]>("/audit?limit=8") });
  if (runs.isLoading || schedules.isLoading || finance.isLoading || approvals.isLoading || failedDepositions.isLoading || operations.isLoading) return <LoadingBlock />;
  if (runs.error || schedules.error || finance.error || approvals.error || failedDepositions.error || operations.error) return <ErrorBlock error={runs.error ?? schedules.error ?? finance.error ?? approvals.error ?? failedDepositions.error ?? operations.error} />;
  const allRuns = runs.data ?? [];
  const active = allRuns.filter((run) => ["queued", "running"].includes(run.status));
  const pendingApprovals = approvals.data ?? [];
  const attention = allRuns.filter((run) => run.status === "waiting_input" || run.status === "waiting_approval" || run.status === "failed" || run.reviewStatus === "pending");
  const depositions = failedDepositions.data ?? [];
  const scheduleAlerts = (operations.data ?? []).filter((item) => item.health === "degraded" && item.failureCategory === "scheduler");
  const totalAttention = attention.length + depositions.length + scheduleAlerts.length;
  return <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="page-stack">
    <PageHeader title="今天" description="先处理阻塞，再看正在推进的工作。" actions={<Link className="button primary" href="/runs">发起运行 <ArrowRightIcon /></Link>} />
    <section className="metric-band" aria-label="今日概览">
      <Metric icon={<PulseIcon />} label="活跃运行" value={String(active.length)} hint="正在排队或执行" />
      <Metric icon={<ShieldWarningIcon />} label="需要处理" value={String(totalAttention)} hint="输入、审批、验收、调度、恢复或沉淀" tone={totalAttention ? "warn" : undefined} />
      <Metric icon={<ClockCountdownIcon />} label="已启用定时" value={String((schedules.data ?? []).filter((item) => item.enabled).length)} hint="由统一调度器触发" />
      <Metric icon={<CheckCircleIcon />} label="本月净现金" value={money(finance.data?.netMinor ?? 0)} hint={`${money(finance.data?.incomeMinor ?? 0)} 收入 · ${money(finance.data?.expenseMinor ?? 0)} 支出`} />
    </section>
    {totalAttention > 0 && <section className="approval-inbox panel"><div className="section-heading"><div><h2>需要你处理</h2><p>等待、审批、验收、调度异常、失败恢复和知识沉淀都集中在这里。</p></div><Link href={scheduleAlerts.length ? "/radar" : "/runs"}>{scheduleAlerts.length ? "查看雷达运营" : "进入运行中心"}</Link></div><div>{depositions.slice(0, 8).map((item) => <Link href={`/runs/${item.runId}`} key={item.id}><span><BookOpenTextIcon /><strong>Obsidian 沉淀失败：{item.title}</strong></span><small>{item.errorMessage ?? "打开运行后重试"}</small></Link>)}{scheduleAlerts.slice(0, Math.max(0, 8 - depositions.length)).map((item) => <Link href={`/radar/${item.workSpec.id}`} key={`schedule-${item.workSpec.id}`}><span><ClockCountdownIcon /><strong>定时执行异常：{item.workSpec.title}</strong></span><small>{item.attentionReason ?? "打开雷达查看调度记录"}</small></Link>)}{attention.slice(0, Math.max(0, 8 - depositions.length - scheduleAlerts.length)).map((run) => { const approval = pendingApprovals.find((item) => item.runId === run.id); return <Link href={`/runs/${run.id}`} key={run.id}><span>{attentionIcon(run)}<strong>{approval?.summary ?? attentionLabel(run)}</strong></span><small>{run.executorType} · {formatDate(run.createdAt)}</small></Link>; })}</div></section>}
    <div className="content-split">
      <section className="panel main-panel"><div className="section-heading"><div><h2>最近运行</h2><p>失败不会覆盖历史，重试会形成新的尝试。</p></div><Link href="/runs">查看全部</Link></div>
        <div className="run-list">{allRuns.slice(0, 6).map((run) => <Link href={`/runs?selected=${run.id}`} className="run-row" key={run.id}><div><strong>{run.id.slice(0, 8)}</strong><small>{formatDate(run.createdAt)}，第 {run.attempt} 次</small></div><Status value={run.status} /></Link>)}{allRuns.length === 0 && <p className="quiet">还没有运行。先去「运行」创建第一项工作。</p>}</div>
      </section>
      <aside className="panel side-panel"><div className="section-heading"><div><h2>接下来</h2><p>未来最近的自动触发。</p></div></div>
        <div className="schedule-stack">{(schedules.data ?? []).filter((item) => item.enabled).slice(0, 4).map((schedule) => <div key={schedule.id}><strong>{schedule.name}</strong><span>{formatDate(schedule.nextRunAt)}</span></div>)}{!(schedules.data ?? []).some((item) => item.enabled) && <p className="quiet">没有启用的定时任务。</p>}</div>
        <div className="section-heading compact"><div><h2>最近审计</h2></div></div>
        <div className="audit-list">{(audit.data ?? []).slice(0, 5).map((item) => <div key={item.id}><span>{item.action}</span><time>{formatDate(item.createdAt)}</time></div>)}</div>
      </aside>
    </div>
  </motion.div>;
}

function attentionLabel(run: Run): string { if (run.status === "waiting_input") return "Runtime 正在等待你的输入"; if (run.status === "waiting_approval") return "高风险动作正在等待审批"; if (run.status === "failed") return run.errorMessage || "运行失败，可以检查并重试"; return "运行结果正在等待人工验收"; }
function attentionIcon(run: Run) { if (run.status === "waiting_input") return <ChatCenteredTextIcon />; if (run.status === "failed") return <ArrowClockwiseIcon />; if (run.reviewStatus === "pending") return <CheckCircleIcon />; return <ShieldWarningIcon />; }
function currentMonth(): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).formatToParts(new Date()); return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`; }

function Metric({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint: string; tone?: "warn" }) {
  return <div className={`metric ${tone ? `metric-${tone}` : ""}`}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>;
}
