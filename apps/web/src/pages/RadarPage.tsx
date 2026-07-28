import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, CalendarBlank, CheckCircle, Clock, Crosshair, Flask, Lightning, Sparkle } from "@phosphor-icons/react";
import { api } from "../api";
import { DemoBanner, EmptyState, ErrorState, LoadingState, SectionHeader } from "../components/UI";
import { useSuccessToast } from "../components/SuccessToast";

function formatDateTime(value: string | null, timezone = "Asia/Tokyo"): string {
  if (!value) return "尚无记录";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" })
    .format(new Date(`${value}T12:00:00`));
}

function scheduleLabel(expression: string): string {
  return expression === "0 8 * * *" ? "每天 08:00" : expression;
}

export function RadarPage() {
  const queryClient = useQueryClient();
  const { showSuccess } = useSuccessToast();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.reports });
  const schedule = useQuery({ queryKey: ["report-schedule"], queryFn: api.reportSchedule, refetchInterval: 60_000 });
  const reportItems = reports.data?.items ?? [];
  const selectedReport = reportItems.find((item) => item.id === selectedReportId) ?? reportItems[0] ?? null;

  const convert = useMutation({
    mutationFn: api.createExperiment,
    onSuccess: async () => {
      showSuccess("机会已转为最小实验");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["experiments"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });
  const generate = useMutation({
    mutationFn: api.generateReport,
    onSuccess: async (generatedReport) => {
      setSelectedReportId(generatedReport.id);
      showSuccess(generatedReport.isDemo ? "演示机会报告已生成" : "中文机会报告已生成");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: ["report-schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });

  if (reports.isLoading) return <LoadingState label="正在读取每日调研记录" />;
  if (reports.error) return <ErrorState error={reports.error} retry={() => reports.refetch()} />;
  const items = selectedReport?.opportunities ?? [];
  const timezone = schedule.data?.timezone ?? "Asia/Tokyo";

  return (
    <div className="page-stack">
      {selectedReport?.isDemo ? <DemoBanner /> : null}
      <section className="radar-intro">
        <div>
          <Crosshair size={30} weight="duotone" />
          <h2>{selectedReport?.title ?? "今天还没有机会报告"}</h2>
          <p>{selectedReport?.summary ?? "系统会在每天早上自动完成一轮只读网络调研，也可以现在手动生成。"}</p>
        </div>
        <nav className="radar-actions" aria-label="生成日报">
          <button className="secondary-button" onClick={() => generate.mutate("demo")} disabled={generate.isPending}><Sparkle size={17} />生成演示</button>
          <button className="primary-button" onClick={() => generate.mutate("live")} disabled={generate.isPending}><Sparkle size={17} weight="fill" />{generate.isPending ? "Codex 正在中文调研" : "立即中文调研"}</button>
        </nav>
      </section>

      <section className="radar-schedule-panel" data-enabled={schedule.data?.enabled ?? false}>
        <div className="radar-schedule-lead">
          <span><CheckCircle size={17} weight="fill" />{schedule.data?.enabled ? "每日自动调研已开启" : "每日自动调研未开启"}</span>
          <h2>{schedule.data ? scheduleLabel(schedule.data.expression) : "正在读取调研计划"} 自动寻找低成本机会</h2>
          <p>Codex 会只读检索公开网络，整理成简体中文报告，并保留每天的调研记录和证据链接。</p>
        </div>
        <dl className="radar-schedule-facts">
          <div><dt><Clock size={15} />下次调研</dt><dd>{formatDateTime(schedule.data?.nextRunAt ?? null, timezone)}</dd></div>
          <div><dt><CalendarBlank size={15} />上次完成</dt><dd>{formatDateTime(schedule.data?.lastRunAt ?? null, timezone)}</dd></div>
          <div><dt><Crosshair size={15} />运行方式</dt><dd>{schedule.data?.mode === "live" ? "Live Codex" : "演示模式"}</dd></div>
          <div><dt><Clock size={15} />时区</dt><dd>{timezone}</dd></div>
        </dl>
      </section>
      {schedule.error ? <p className="inline-error">无法读取自动调研计划：{schedule.error.message}</p> : null}

      <section className="report-history-panel">
        <header>
          <div><span>调研归档</span><h2>每日机会报告</h2><p>点击日期可回看当天的候选机会和原始证据。</p></div>
          <strong>{reportItems.length} 份</strong>
        </header>
        {reportItems.length === 0 ? <p className="report-history-empty">第一份自动报告生成后会出现在这里。</p> : (
          <div className="report-history-list">
            {reportItems.map((report) => (
              <button
                type="button"
                className={selectedReport?.id === report.id ? "selected" : ""}
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                aria-pressed={selectedReport?.id === report.id}
              >
                <time dateTime={report.reportDate}>{formatReportDate(report.reportDate)}</time>
                <span>{report.opportunities.length} 个机会</span>
                <small>{report.isDemo ? "演示" : report.generatedBy === "codex" ? "实时调研" : report.generatedBy}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <SectionHeader
        title="本期调研结果"
        description={selectedReport ? `${formatReportDate(selectedReport.reportDate)}，${selectedReport.isDemo ? "演示数据" : "中文实时调研"}。评分用于比较，每条证据仍需回到原始来源核验。` : "日报不会为了填满页面而编造机会。"}
      />
      {items.length === 0 ? <EmptyState title="本期没有候选机会" body="可以等待下一次自动调研，或者现在手动发起一轮中文调研。" /> : (
        <div className="opportunity-list">
          {items.map((opportunity) => (
            <article className="opportunity-panel" key={opportunity.id}>
              <header>
                <div><span className="evidence-count">{opportunity.evidence.length} 条证据</span><h2>{opportunity.title}</h2><p>{opportunity.summary}</p></div>
                <div className="score-orbit" aria-label={`匹配分 ${opportunity.score}`}><strong>{opportunity.score}</strong><span>匹配分</span></div>
              </header>
              <div className="opportunity-grid">
                <div><span>谁会付钱</span><strong>{opportunity.payer}</strong></div>
                <div><span>收费路径</span><strong>{opportunity.businessModel}</strong></div>
                <div><span>验证投入</span><strong>{opportunity.validationEffortHours} 小时 / ¥{opportunity.validationBudget}</strong></div>
                <div><span>首次收入</span><strong>{opportunity.timeToRevenue}</strong></div>
              </div>
              <div className="experiment-callout">
                <Lightning size={20} weight="fill" aria-hidden="true" />
                <div><span>最小实验</span><p>{opportunity.minimalExperiment}</p></div>
              </div>
              <div className="conditions-grid">
                <div><span>继续条件</span><p>{opportunity.successCondition}</p></div>
                <div><span>停止条件</span><p>{opportunity.stopCondition}</p></div>
              </div>
              <div className="evidence-list">
                {opportunity.evidence.map((evidence) => (
                  <a key={evidence.id} href={evidence.sourceUrl} target="_blank" rel="noreferrer">
                    <span data-kind={evidence.type}>{evidence.type === "fact" ? "事实" : "推断"}</span>
                    <div><strong>{evidence.label}</strong><p>{evidence.summary}</p></div>
                    <ArrowSquareOut size={16} />
                  </a>
                ))}
              </div>
              <footer><span>{opportunity.isDemo ? "演示候选，仅用于验证流程" : "来源已登记，仍需人工核验"}</span><button className="secondary-button" onClick={() => convert.mutate(opportunity.id)} disabled={convert.isPending || opportunity.status === "experiment"}><Flask size={17} />{opportunity.status === "experiment" ? "已进入实验" : "启动最小实验"}</button></footer>
            </article>
          ))}
        </div>
      )}
      {generate.error || convert.error ? <p className="inline-error">{generate.error?.message ?? convert.error?.message}</p> : null}
    </div>
  );
}
