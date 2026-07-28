import { useQuery } from "@tanstack/react-query";
import { Clock, CurrencyCny, Flag, Flask, StopCircle } from "@phosphor-icons/react";
import { api } from "../api";
import { EmptyState, ErrorState, formatDate, formatMoney, LoadingState, SectionHeader } from "../components/UI";

const experimentLabels: Record<string, string> = {
  hypothesis: "假设",
  preparing: "准备中",
  running: "测试中",
  measuring: "收集结果",
  won: "验证成功",
  lost: "验证失败",
  pivoted: "已调整"
};

export function ExperimentsPage() {
  const experiments = useQuery({ queryKey: ["experiments"], queryFn: api.experiments });
  if (experiments.isLoading) return <LoadingState label="正在读取实验状态" />;
  if (experiments.error) return <ErrorState error={experiments.error} retry={() => experiments.refetch()} />;
  const items = experiments.data?.items ?? [];

  return (
    <div className="page-stack">
      <SectionHeader title="受控的小赌注" description="每个实验都必须知道最多投入多少，以及什么时候停止。" />
      {items.length === 0 ? <EmptyState title="还没有实验" body="从机会雷达选择一个有证据的候选机会。" /> : (
        <div className="experiment-timeline">
          {items.map((experiment) => (
            <article className="experiment-row" key={experiment.id}>
              <div className="experiment-index"><Flask size={21} weight="duotone" /></div>
              <div className="experiment-main">
                <div className="experiment-title"><span>{experimentLabels[experiment.status] ?? experiment.status}</span><h2>{experiment.title}</h2></div>
                <p>{experiment.hypothesis}</p>
                <div className="experiment-conditions">
                  <div><Flag size={17} weight="duotone" /><span>继续条件</span><strong>{experiment.successCondition}</strong></div>
                  <div><StopCircle size={17} weight="duotone" /><span>停止条件</span><strong>{experiment.stopCondition}</strong></div>
                </div>
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
