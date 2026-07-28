import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Select, TextArea, TextField } from "@radix-ui/themes";
import { ChartLineUp, Clock, CurrencyCny, Flag, Flask, PencilSimple, StopCircle } from "@phosphor-icons/react";
import type { Experiment, ExperimentInput, ExperimentStatus } from "@personal-os/domain";
import { api } from "../api";
import { EmptyState, ErrorState, formatDate, formatMoney, LoadingState, SectionHeader } from "../components/UI";
import { useSuccessToast } from "../components/SuccessToast";

const experimentLabels: Record<ExperimentStatus, string> = {
  hypothesis: "假设",
  preparing: "准备中",
  running: "测试中",
  measuring: "收集结果",
  won: "验证成功",
  lost: "验证失败",
  pivoted: "已调整"
};

const resultStatuses = ["measuring", "won", "lost", "pivoted"] as const;

function experimentToForm(experiment: Experiment): ExperimentInput {
  return {
    opportunityId: experiment.opportunityId,
    title: experiment.title,
    hypothesis: experiment.hypothesis,
    status: experiment.status,
    timeCapHours: experiment.timeCapHours,
    budgetCap: experiment.budgetCap,
    deadline: experiment.deadline,
    successCondition: experiment.successCondition,
    stopCondition: experiment.stopCondition,
    resultSummary: experiment.resultSummary
  };
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ExperimentsPage() {
  const queryClient = useQueryClient();
  const { showSuccess } = useSuccessToast();
  const [detail, setDetail] = useState<Experiment | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "result">("view");
  const [form, setForm] = useState<ExperimentInput | null>(null);
  const [resultStatus, setResultStatus] = useState<(typeof resultStatuses)[number]>("measuring");
  const [resultSummary, setResultSummary] = useState("");
  const experiments = useQuery({ queryKey: ["experiments"], queryFn: api.experiments });

  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["experiments"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  ]);

  const updateExperiment = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExperimentInput }) => api.updateExperiment(id, input),
    onSuccess: async (updated) => {
      setDetail(updated);
      setForm(experimentToForm(updated));
      setMode("view");
      showSuccess("实验详情已保存");
      await refresh();
    }
  });

  const recordResult = useMutation({
    mutationFn: ({ id, status, summary }: { id: string; status: (typeof resultStatuses)[number]; summary: string }) => api.recordExperimentResult(id, { status, resultSummary: summary }),
    onSuccess: async (updated) => {
      setDetail(updated);
      setForm(experimentToForm(updated));
      setMode("view");
      setResultSummary("");
      showSuccess(`实验结果已记录为${experimentLabels[updated.status]}`);
      await refresh();
    }
  });

  const openDetail = (experiment: Experiment) => {
    setDetail(experiment);
    setForm(experimentToForm(experiment));
    setMode("view");
    setResultStatus(experiment.status === "won" || experiment.status === "lost" || experiment.status === "pivoted" ? experiment.status : "measuring");
    setResultSummary(experiment.resultSummary ?? "");
    updateExperiment.reset();
    recordResult.reset();
  };

  const openFromKeyboard = (event: ReactKeyboardEvent<HTMLElement>, experiment: Experiment) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openDetail(experiment);
  };

  if (experiments.isLoading) return <LoadingState label="正在读取实验状态" />;
  if (experiments.error) return <ErrorState error={experiments.error} retry={() => experiments.refetch()} />;
  const items = experiments.data?.items ?? [];

  return (
    <div className="page-stack">
      <SectionHeader title="受控的小赌注" description="每个实验都必须知道最多投入多少，以及什么时候停止。点击实验可以编辑或记录结果。" />

      <Dialog.Root open={Boolean(detail)} onOpenChange={(open) => { if (!open) { setDetail(null); setForm(null); setMode("view"); } }}>
        <Dialog.Content className="form-dialog experiment-detail-dialog" maxWidth="720px">
          {detail && form ? (
            <>
              <div className="experiment-detail-kicker"><span>{experimentLabels[detail.status]}</span><small>更新于 {formatTimestamp(detail.updatedAt)}</small></div>
              <Dialog.Title>{mode === "edit" ? "编辑实验" : mode === "result" ? "记录实验结果" : detail.title}</Dialog.Title>
              <Dialog.Description>{mode === "view" ? detail.hypothesis : mode === "edit" ? "更新实验假设、投入边界和当前状态。" : "写下真实结果，再决定继续、成功、停止或调整方向。"}</Dialog.Description>

              {mode === "edit" ? (
                <form className="form-stack" onSubmit={(event) => { event.preventDefault(); updateExperiment.mutate({ id: detail.id, input: form }); }}>
                  <label><span>实验名称</span><TextField.Root value={form.title} onChange={(event) => { const value = event.target.value; setForm((current) => current ? { ...current, title: value } : current); }} required /></label>
                  <label><span>待验证假设</span><TextArea value={form.hypothesis} onChange={(event) => { const value = event.target.value; setForm((current) => current ? { ...current, hypothesis: value } : current); }} required /></label>
                  <div className="form-grid">
                    <div className="form-field"><span>当前状态</span><Select.Root value={form.status} onValueChange={(value) => setForm((current) => current ? { ...current, status: value as ExperimentStatus } : current)}><Select.Trigger aria-label="实验状态" /><Select.Content>{Object.entries(experimentLabels).map(([value, label]) => <Select.Item key={value} value={value}>{label}</Select.Item>)}</Select.Content></Select.Root></div>
                    <label><span>截止日期</span><TextField.Root type="date" value={form.deadline ?? ""} onChange={(event) => { const value = event.target.value || null; setForm((current) => current ? { ...current, deadline: value } : current); }} /></label>
                  </div>
                  <div className="form-grid">
                    <label><span>时间上限（小时）</span><TextField.Root type="number" min="0.1" step="0.1" value={form.timeCapHours} onChange={(event) => { const value = Number(event.target.value); setForm((current) => current ? { ...current, timeCapHours: value } : current); }} required /></label>
                    <label><span>资金上限</span><TextField.Root type="number" min="0" step="0.01" value={form.budgetCap} onChange={(event) => { const value = Number(event.target.value); setForm((current) => current ? { ...current, budgetCap: value } : current); }} required /></label>
                  </div>
                  <label><span>成功条件</span><TextArea value={form.successCondition} onChange={(event) => { const value = event.target.value; setForm((current) => current ? { ...current, successCondition: value } : current); }} required /></label>
                  <label><span>停止条件</span><TextArea value={form.stopCondition} onChange={(event) => { const value = event.target.value; setForm((current) => current ? { ...current, stopCondition: value } : current); }} required /></label>
                  <label><span>已有结果摘要</span><TextArea value={form.resultSummary ?? ""} onChange={(event) => { const value = event.target.value || null; setForm((current) => current ? { ...current, resultSummary: value } : current); }} /></label>
                  {updateExperiment.error ? <p className="inline-error">{updateExperiment.error.message}</p> : null}
                  <div className="dialog-actions"><Button type="button" variant="soft" color="gray" onClick={() => { setForm(experimentToForm(detail)); setMode("view"); }}>取消</Button><Button type="submit" loading={updateExperiment.isPending}>保存更改</Button></div>
                </form>
              ) : mode === "result" ? (
                <form className="form-stack" onSubmit={(event) => { event.preventDefault(); recordResult.mutate({ id: detail.id, status: resultStatus, summary: resultSummary }); }}>
                  <div className="form-field"><span>结果状态</span><Select.Root value={resultStatus} onValueChange={(value) => setResultStatus(value as (typeof resultStatuses)[number])}><Select.Trigger aria-label="结果状态" /><Select.Content>{resultStatuses.map((status) => <Select.Item key={status} value={status}>{experimentLabels[status]}</Select.Item>)}</Select.Content></Select.Root></div>
                  <label><span>结果摘要</span><TextArea rows={8} value={resultSummary} onChange={(event) => setResultSummary(event.target.value)} placeholder="记录做了什么、得到什么证据，以及下一步判断。" required /></label>
                  {recordResult.error ? <p className="inline-error">{recordResult.error.message}</p> : null}
                  <div className="dialog-actions"><Button type="button" variant="soft" color="gray" onClick={() => setMode("view")}>取消</Button><Button type="submit" loading={recordResult.isPending}>保存结果</Button></div>
                </form>
              ) : (
                <>
                  <dl className="experiment-detail-facts">
                    <div><dt>时间上限</dt><dd>{detail.timeCapHours} 小时</dd></div>
                    <div><dt>资金上限</dt><dd>{formatMoney(detail.budgetCap)}</dd></div>
                    <div><dt>截止日期</dt><dd>{formatDate(detail.deadline)}</dd></div>
                  </dl>
                  <div className="experiment-detail-conditions">
                    <section><Flag size={18} weight="duotone" /><div><span>成功条件</span><p>{detail.successCondition}</p></div></section>
                    <section><StopCircle size={18} weight="duotone" /><div><span>停止条件</span><p>{detail.stopCondition}</p></div></section>
                  </div>
                  <section className="experiment-result-summary"><span>结果记录</span><p>{detail.resultSummary ?? "还没有记录真实结果。实验结束前必须写下证据和判断。"}</p></section>
                  <footer className="experiment-detail-actions"><Button variant="soft" color="gray" onClick={() => setMode("edit")}><PencilSimple size={16} />编辑实验</Button><Button onClick={() => setMode("result")}><ChartLineUp size={16} weight="bold" />记录结果</Button></footer>
                </>
              )}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Root>

      {items.length === 0 ? <EmptyState title="还没有实验" body="从机会雷达选择一个有证据的候选机会。" /> : (
        <div className="experiment-timeline">
          {items.map((experiment) => (
            <article className="experiment-row" key={experiment.id} role="button" tabIndex={0} onClick={() => openDetail(experiment)} onKeyDown={(event) => openFromKeyboard(event, experiment)} aria-label={`查看实验 ${experiment.title}`}>
              <div className="experiment-index"><Flask size={21} weight="duotone" /></div>
              <div className="experiment-main">
                <div className="experiment-title"><span>{experimentLabels[experiment.status]}</span><h2>{experiment.title}</h2></div>
                <p>{experiment.hypothesis}</p>
                <div className="experiment-conditions">
                  <div><Flag size={17} weight="duotone" /><span>继续条件</span><strong>{experiment.successCondition}</strong></div>
                  <div><StopCircle size={17} weight="duotone" /><span>停止条件</span><strong>{experiment.stopCondition}</strong></div>
                </div>
                {experiment.resultSummary ? <p className="experiment-result-preview">结果：{experiment.resultSummary}</p> : null}
              </div>
              <dl className="experiment-limits">
                <div><dt><Clock size={16} />时间上限</dt><dd>{experiment.timeCapHours} 小时</dd></div>
                <div><dt><CurrencyCny size={16} />资金上限</dt><dd>{formatMoney(experiment.budgetCap)}</dd></div>
                <div><dt>截止</dt><dd>{formatDate(experiment.deadline)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
