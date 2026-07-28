import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, Crosshair, Flask, Lightning, Sparkle } from "@phosphor-icons/react";
import { api } from "../api";
import { DemoBanner, EmptyState, ErrorState, LoadingState, SectionHeader } from "../components/UI";

export function RadarPage() {
  const queryClient = useQueryClient();
  const opportunities = useQuery({ queryKey: ["opportunities"], queryFn: api.opportunities });
  const report = useQuery({ queryKey: ["report"], queryFn: api.latestReport, retry: false });
  const convert = useMutation({
    mutationFn: api.createExperiment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["experiments"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });
  const generate = useMutation({
    mutationFn: api.generateReport,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["report"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });

  if (opportunities.isLoading) return <LoadingState label="正在读取机会证据" />;
  if (opportunities.error) return <ErrorState error={opportunities.error} retry={() => opportunities.refetch()} />;
  const items = opportunities.data?.items ?? [];

  return (
    <div className="page-stack">
      {report.data?.isDemo ? <DemoBanner /> : null}
      <section className="radar-intro">
        <div>
          <Crosshair size={30} weight="duotone" />
          <h2>{report.data?.title ?? "今天还没有报告"}</h2>
          <p>{report.data?.summary ?? "先生成一份演示报告，验证信息结构和决策流程。"}</p>
        </div>
        <nav className="radar-actions" aria-label="生成日报">
          <button className="secondary-button" onClick={() => generate.mutate("demo")} disabled={generate.isPending}><Sparkle size={17} />生成 Demo</button>
          <button className="primary-button" onClick={() => generate.mutate("live")} disabled={generate.isPending}><Sparkle size={17} weight="fill" />{generate.isPending ? "Codex 正在研究" : "Live 机会研究"}</button>
        </nav>
      </section>

      <SectionHeader title="候选机会" description="评分帮助比较，不代表收入保证。每条证据都要回到原始来源核验。" />
      {items.length === 0 ? <EmptyState title="没有候选机会" body="日报不会为了填满页面而编造机会。" /> : (
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
