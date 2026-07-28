import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Clock, Command, CurrencyCny, Play, Robot, TrendUp } from "@phosphor-icons/react";
import { Link } from "wouter";
import { api } from "../api";
import { AnimatedValue, DemoBanner, EmptyState, ErrorState, formatMoney, LoadingState, SectionHeader, StatusBadge, laneLabels } from "../components/UI";

export function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const assign = useMutation({
    mutationFn: (taskId: string) => api.assignTask(taskId, "demo"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] })
      ]);
    }
  });

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.error) return <ErrorState error={dashboard.error} retry={() => dashboard.refetch()} />;
  if (!dashboard.data) return null;

  const { metrics, focusTasks, projects, opportunities, runs, latestReport } = dashboard.data;

  return (
    <div className="page-stack dashboard-page">
      <motion.section
        className="dashboard-hero"
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="hero-copy">
          <span className="hero-kicker"><Command size={15} weight="bold" />EXECUTION WINDOW</span>
          <h2>今天，闭环 <em>{metrics.openLoops}</em> 件事。</h2>
          <p>把判断留给你，把清晰的执行交给系统。</p>
          <Link className="hero-cta" href="/tasks">进入任务流<ArrowRight size={18} weight="bold" /></Link>
        </div>
        <div className="focus-orbit" aria-hidden="true">
          <span className="orbit-ring orbit-ring-one" />
          <span className="orbit-ring orbit-ring-two" />
          <span className="orbit-satellite satellite-one" />
          <span className="orbit-satellite satellite-two" />
          <div className="orbit-core"><strong>{focusTasks.length}</strong><span>FOCUS</span></div>
        </div>
        <div className="hero-metrics" aria-label="关键指标">
          <div><span>活跃项目</span><strong><AnimatedValue value={metrics.activeProjects} /></strong><small>有限在制品</small></div>
          <div><span>当前收入</span><strong><AnimatedValue value={metrics.monthlyRevenue} format={(value) => formatMoney(Math.round(value))} /></strong><small>演示期口径</small></div>
          <div><span>低维护收入</span><strong><AnimatedValue value={metrics.lowTouchRevenue} format={(value) => formatMoney(Math.round(value))} /></strong><small>{metrics.maintenanceHours} 小时维护</small></div>
        </div>
      </motion.section>

      {latestReport?.isDemo ? <DemoBanner /> : null}

      <motion.div className="dashboard-grid" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.58, ease: [0.16, 1, 0.3, 1] }}>
        <section className="surface focus-surface">
          <SectionHeader
            title="今天先闭环"
            description="按紧急程度和可执行性排序。"
            action={<Link className="text-link" href="/tasks">全部任务<ArrowRight size={15} /></Link>}
          />
          {focusTasks.length === 0 ? (
            <EmptyState title="今天没有待处理任务" body="新的事项会先进入 Inbox。" />
          ) : (
            <div className="focus-list">
              {focusTasks.slice(0, 5).map((task) => (
                <article className="focus-row" key={task.id}>
                  <div className="priority-marker" data-priority={task.priority} role="img" aria-label={`优先级 ${task.priority}`} />
                  <div className="focus-copy">
                    <div className="row-title-line"><strong>{task.title}</strong><StatusBadge status={task.status} /></div>
                    <p>{task.description || "尚未补充任务说明。"}</p>
                  </div>
                  {task.delegationMode !== "human_only" && task.status === "ready" ? (
                    <button className="compact-button" disabled={assign.isPending} onClick={() => assign.mutate(task.id)}>
                      <Robot size={17} weight="duotone" />Demo 交给 Codex
                    </button>
                  ) : (
                    <span className="delegation-label">{task.delegationMode === "human_only" ? "本人处理" : "等待下一步"}</span>
                  )}
                </article>
              ))}
            </div>
          )}
          {assign.error ? <p className="inline-error">{assign.error.message}</p> : null}
        </section>

        <section className="surface codex-surface">
          <SectionHeader
            title="Codex 队列"
            description="所有机器执行都回到人工审查。"
            action={<Link className="icon-link" href="/review" aria-label="打开 Codex 审查"><ArrowRight size={18} /></Link>}
          />
          {runs.length === 0 ? (
            <EmptyState title="还没有执行记录" body="从可执行任务开始一次 Demo 或 Live 运行。" />
          ) : (
            <div className="run-stack">
              {runs.slice(0, 4).map((run) => (
                <article key={run.id} className="run-item">
                  <div className="run-icon"><Robot size={18} weight="duotone" /></div>
                  <div><strong>{run.promptSnapshot}</strong><span>{run.mode === "demo" ? "Demo 适配器" : "Live Codex"}</span></div>
                  <StatusBadge status={run.status} demo={run.mode === "demo"} />
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="surface portfolio-surface">
          <SectionHeader title="项目组合" description="现金流和长期资产需要同时有进展。" />
          <div className="portfolio-board">
            {(["cash_now", "systemize", "assets", "life_ops"] as const).map((lane) => {
              const laneProjects = projects.filter((project) => project.lane === lane);
              return (
                <div className="portfolio-lane" key={lane}>
                  <div className="lane-heading"><span>{laneLabels[lane]}</span><strong>{laneProjects.length}</strong></div>
                  {laneProjects.length > 0 ? laneProjects.slice(0, 2).map((project) => (
                    <article key={project.id}>
                      <strong>{project.name}</strong>
                      <p>{project.nextAction}</p>
                      <StatusBadge status={project.status} />
                    </article>
                  )) : <span className="lane-empty">暂无活跃项目</span>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface radar-surface">
          <SectionHeader
            title="今日机会"
            description={latestReport?.reportDate ? `${latestReport.reportDate} 的候选报告` : "尚未生成日报"}
            action={<Link className="text-link" href="/radar">查看证据<ArrowRight size={15} /></Link>}
          />
          <div className="opportunity-briefs">
            {opportunities.length === 0 ? <EmptyState title="今日没有新候选" body="所有机会都已进入实验或归档。" /> : opportunities.slice(0, 3).map((opportunity, index) => (
              <article key={opportunity.id}>
                <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{opportunity.title}</strong><p>{opportunity.payer}</p></div>
                <div className="opportunity-score"><strong>{opportunity.score}</strong><span>匹配分</span></div>
              </article>
            ))}
          </div>
        </section>
      </motion.div>

      <section className="decision-strip">
        <div><Play size={19} weight="fill" /><span>开始</span><strong>只启动能在限定时间内验证的工作</strong></div>
        <div><Check size={19} weight="bold" /><span>完成</span><strong>结果必须经过人工验收</strong></div>
        <div><TrendUp size={19} weight="duotone" /><span>提取</span><strong>每次客户交付都寻找复用资产</strong></div>
        <div><Clock size={19} weight="duotone" /><span>衡量</span><strong>收入和维护时间同时记录</strong></div>
        <div><CurrencyCny size={19} weight="duotone" /><span>验证</span><strong>先确认付费意愿，再扩大投入</strong></div>
      </section>
    </div>
  );
}
