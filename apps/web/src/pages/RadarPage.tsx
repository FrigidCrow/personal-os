import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Dialog, Select, TextArea, TextField } from "@radix-ui/themes";
import { ArrowSquareOut, CalendarBlank, CheckCircle, Clock, Crosshair, Flask, GearSix, Lightning, Sparkle } from "@phosphor-icons/react";
import { api, type RadarScheduleInput } from "../api";
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
  const [minute = "", hour = "", dayOfMonth = "", month = "", dayOfWeek = ""] = expression.trim().split(/\s+/);
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*" && /^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    return `每天 ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  return expression;
}

function timeFromExpression(expression: string): string {
  const [minute = "", hour = "", dayOfMonth = "", month = "", dayOfWeek = ""] = expression.trim().split(/\s+/);
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*" && /^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  return "08:00";
}

function expressionFromTime(time: string): string {
  const [hour, minute] = time.split(":");
  return `${Number(minute)} ${Number(hour)} * * *`;
}

function runStatusLabel(status: "idle" | "running" | "succeeded" | "failed" | "skipped" | undefined): string {
  return { idle: "等待执行", running: "正在调研", succeeded: "最近一次成功", failed: "最近一次失败", skipped: "最近一次已跳过" }[status ?? "idle"];
}

export function RadarPage() {
  const queryClient = useQueryClient();
  const { showSuccess } = useSuccessToast();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    enabled: true,
    time: "08:00",
    timezone: "Asia/Tokyo",
    catchUp: true,
    executor: "openworker" as "codex" | "openworker",
    searchProfile: "操作者会开发软件、使用 Codex、承接客户项目，希望以低维护的产品化服务或数字资产建立经常性收入。",
    customInstructions: ""
  });
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.reports });
  const schedule = useQuery({ queryKey: ["report-schedule"], queryFn: api.reportSchedule, refetchInterval: 60_000 });
  const reportItems = reports.data?.items ?? [];
  const selectedReport = reportItems.find((item) => item.id === selectedReportId) ?? reportItems[0] ?? null;

  const openScheduleSettings = () => {
    const current = schedule.data;
    setSettingsForm({
      enabled: current?.enabled ?? true,
      time: timeFromExpression(current?.expression ?? "0 8 * * *"),
      timezone: current?.timezone ?? "Asia/Tokyo",
      catchUp: current?.catchUp ?? true,
      executor: current?.executor ?? "openworker",
      searchProfile: current?.searchProfile ?? "操作者会开发软件、使用 Codex、承接客户项目，希望以低维护的产品化服务或数字资产建立经常性收入。",
      customInstructions: current?.customInstructions ?? ""
    });
    setSettingsOpen(true);
  };

  const updateSchedule = useMutation({
    mutationFn: (input: RadarScheduleInput) => api.updateReportSchedule(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["report-schedule"], updated);
      setSettingsOpen(false);
      showSuccess(updated.enabled ? `机会雷达已设为${scheduleLabel(updated.expression)}自动调研` : "机会雷达自动调研已暂停");
    }
  });

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
  const queueNow = useMutation({
    mutationFn: api.queueReportNow,
    onSuccess: async (queued) => {
      queryClient.setQueryData(["report-schedule"], { ...schedule.data, ...queued });
      showSuccess("机会调研已加入 OpenWorker 队列，通常会在五分钟内开始");
      await queryClient.invalidateQueries({ queryKey: ["report-schedule"] });
    }
  });

  if (reports.isLoading) return <LoadingState label="正在读取每日调研记录" />;
  if (reports.error) return <ErrorState error={reports.error} retry={() => reports.refetch()} />;
  const items = selectedReport?.opportunities ?? [];
  const timezone = schedule.data?.timezone ?? "Asia/Tokyo";

  return (
    <div className="page-stack">
      <Dialog.Root open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (!open) updateSchedule.reset(); }}>
        <Dialog.Content className="form-dialog radar-settings-dialog" maxWidth="720px">
          <div className="radar-settings-kicker"><GearSix size={17} weight="duotone" /><span>定时任务设置</span><small>{runStatusLabel(schedule.data?.lastStatus)}</small></div>
          <Dialog.Title>机会雷达自动调研</Dialog.Title>
          <Dialog.Description>设置执行时间、执行器和搜索提示词。保存后会立即按新规则计算下一次执行。</Dialog.Description>
          <form className="form-stack" onSubmit={(event) => {
            event.preventDefault();
            updateSchedule.mutate({
              enabled: settingsForm.enabled,
              expression: expressionFromTime(settingsForm.time),
              timezone: settingsForm.timezone,
              catchUp: settingsForm.catchUp,
              executor: settingsForm.executor,
              searchProfile: settingsForm.searchProfile,
              customInstructions: settingsForm.customInstructions
            });
          }}>
            <label className="radar-setting-toggle"><Checkbox checked={settingsForm.enabled} onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, enabled: checked === true }))} /><span><strong>启用每日自动调研</strong><small>关闭后仍保留历史报告和当前设置。</small></span></label>
            <div className="form-grid">
              <label><span>每天执行时间</span><TextField.Root aria-label="每天执行时间" type="time" value={settingsForm.time} onChange={(event) => setSettingsForm((current) => ({ ...current, time: event.target.value }))} required /></label>
              <label><span>时区</span><TextField.Root aria-label="机会雷达时区" value={settingsForm.timezone} onChange={(event) => setSettingsForm((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Tokyo" required /></label>
            </div>
            <label><span>执行器</span><Select.Root value={settingsForm.executor} onValueChange={(value: "codex" | "openworker") => setSettingsForm((current) => ({ ...current, executor: value }))}><Select.Trigger aria-label="机会雷达执行器" /><Select.Content><Select.Item value="openworker">OpenWorker，使用当前 DeepSeek 配置</Select.Item><Select.Item value="codex">Codex，本机账号额度</Select.Item></Select.Content></Select.Root></label>
            <label className="radar-setting-toggle"><Checkbox checked={settingsForm.catchUp} onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, catchUp: checked === true }))} /><span><strong>错过后补跑一次</strong><small>电脑离线或服务暂停时，恢复后只补最近一次，不连续补多天。</small></span></label>
            <section className="radar-rules-section" aria-labelledby="radar-rules-title">
              <div><span>发现规则</span><h3 id="radar-rules-title">定义雷达要为谁寻找什么</h3><p>这里的内容会原样加入每次调研。你可以持续补充擅长领域、可投入时间、排除方向和偏好的销售方式。</p></div>
              <label><span>个人能力与目标画像</span><TextArea aria-label="个人能力与目标画像" value={settingsForm.searchProfile} onChange={(event) => setSettingsForm((current) => ({ ...current, searchProfile: event.target.value }))} rows={4} required /></label>
              <label><span>额外搜索规则和提示词</span><TextArea aria-label="额外搜索规则和提示词" value={settingsForm.customInstructions} onChange={(event) => setSettingsForm((current) => ({ ...current, customInstructions: event.target.value }))} rows={5} placeholder="例如：排除需要囤货的项目；优先日本和中文市场；单次验证不超过 300 元。" /></label>
              <div className="radar-sales-gate"><CheckCircle size={18} weight="fill" /><div><strong>系统固定成交门槛</strong><p>必须找到可核验的买家渠道和直达链接，并写清产品、定价、进入渠道的方法与第一单步骤。找不到渠道的候选不会进入日报。</p></div></div>
            </section>
            <section className="radar-setting-preview"><Clock size={17} /><div><span>保存后的计划</span><strong>{settingsForm.enabled ? `每天 ${settingsForm.time}，${settingsForm.timezone}，${settingsForm.executor === "openworker" ? "OpenWorker" : "Codex"}` : "自动调研暂停"}</strong></div></section>
            {updateSchedule.error ? <p className="inline-error">{updateSchedule.error.message}</p> : null}
            <div className="dialog-actions"><Dialog.Close><Button type="button" variant="soft" color="gray">取消</Button></Dialog.Close><Button type="submit" loading={updateSchedule.isPending}>保存定时设置</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Root>
      {selectedReport?.isDemo ? <DemoBanner /> : null}
      <section className="radar-intro">
        <div>
          <Crosshair size={30} weight="duotone" />
          <h2>{selectedReport?.title ?? "今天还没有机会报告"}</h2>
          <p>{selectedReport?.summary ?? "系统会在每天早上自动完成一轮只读网络调研，也可以现在手动生成。"}</p>
        </div>
        <nav className="radar-actions" aria-label="生成日报">
          <button className="secondary-button" onClick={() => generate.mutate("demo")} disabled={generate.isPending}><Sparkle size={17} />生成演示</button>
          <button className="primary-button" onClick={() => schedule.data?.executor === "openworker" ? queueNow.mutate() : generate.mutate("live")} disabled={generate.isPending || queueNow.isPending || !schedule.data?.enabled}><Sparkle size={17} weight="fill" />{queueNow.isPending ? "正在加入队列" : generate.isPending ? "Codex 正在中文调研" : "立即中文调研"}</button>
        </nav>
      </section>

      <section className="radar-schedule-panel" data-enabled={schedule.data?.enabled ?? false}>
        <div className="radar-schedule-lead">
          <div className="radar-schedule-statusline"><span><CheckCircle size={17} weight="fill" />{schedule.data?.enabled ? "每日自动调研已开启" : "每日自动调研已暂停"}</span><button className="secondary-button radar-settings-button" type="button" onClick={openScheduleSettings} disabled={!schedule.data}><GearSix size={16} />定时设置</button></div>
          <h2>{schedule.data?.enabled ? `${scheduleLabel(schedule.data.expression)} 自动寻找低成本机会` : "自动调研当前已暂停"}</h2>
          <p>{schedule.data?.executor === "openworker" ? "OpenWorker 会使用当前 DeepSeek 配置只读检索公开网络" : "Codex 会只读检索公开网络"}，只保留具有可核验销售渠道的中文机会报告。</p>
          {schedule.data?.lastError ? <p className="radar-schedule-error">{runStatusLabel(schedule.data.lastStatus)}：{schedule.data.lastError}</p> : null}
        </div>
        <dl className="radar-schedule-facts">
          <div><dt><Clock size={15} />下次调研</dt><dd>{formatDateTime(schedule.data?.nextRunAt ?? null, timezone)}</dd></div>
          <div><dt><CalendarBlank size={15} />上次完成</dt><dd>{formatDateTime(schedule.data?.lastRunAt ?? null, timezone)}</dd></div>
          <div><dt><Crosshair size={15} />运行方式</dt><dd>{schedule.data?.executor === "openworker" ? "OpenWorker / DeepSeek" : schedule.data?.mode === "live" ? "Live Codex" : "演示模式"}</dd></div>
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
                <small>{report.isDemo ? "演示" : report.generatedBy === "codex" ? "Codex 调研" : report.generatedBy === "openworker" ? "OpenWorker 调研" : report.generatedBy}</small>
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
                <div><span>怎么收费</span><strong>{opportunity.pricingModel || opportunity.businessModel}</strong></div>
                <div><span>验证投入</span><strong>{opportunity.validationEffortHours} 小时 / ¥{opportunity.validationBudget}</strong></div>
                <div><span>首次收入</span><strong>{opportunity.timeToRevenue}</strong></div>
              </div>
              {opportunity.salesChannels.length > 0 ? (
                <section className="sales-path-panel">
                  <div className="sales-path-heading"><span>成交路径已验证</span><h3>{opportunity.offer}</h3><p>{opportunity.firstSalePlan}</p></div>
                  <div className="sales-channel-list">
                    {opportunity.salesChannels.map((channel) => (
                      <a key={`${channel.name}-${channel.sourceUrl}`} href={channel.sourceUrl} target="_blank" rel="noreferrer">
                        <div><strong>{channel.name}</strong><p>{channel.accessMethod}</p></div><ArrowSquareOut size={16} />
                      </a>
                    ))}
                  </div>
                </section>
              ) : <p className="sales-path-missing">这是一条历史机会，尚未通过新的销售渠道门槛，不能直接进入实验。</p>}
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
              <footer><span>{opportunity.isDemo ? "演示候选，仅用于验证流程" : opportunity.salesChannels.length > 0 ? "渠道与来源已登记，行动前仍需人工核验" : "未通过销售渠道门槛"}</span><button className="secondary-button" onClick={() => convert.mutate(opportunity.id)} disabled={convert.isPending || opportunity.status === "experiment" || opportunity.salesChannels.length === 0}><Flask size={17} />{opportunity.status === "experiment" ? "已进入实验" : "启动最小实验"}</button></footer>
            </article>
          ))}
        </div>
      )}
      {generate.error || queueNow.error || convert.error ? <p className="inline-error">{generate.error?.message ?? queueNow.error?.message ?? convert.error?.message}</p> : null}
    </div>
  );
}
