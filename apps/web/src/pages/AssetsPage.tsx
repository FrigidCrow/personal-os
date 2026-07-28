import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, CurrencyCny, Cube, Wrench } from "@phosphor-icons/react";
import { api } from "../api";
import { EmptyState, ErrorState, formatMoney, LoadingState, SectionHeader } from "../components/UI";

const stages = ["idea", "evidence", "experiment", "building", "launched", "revenue", "systemized"] as const;
const stageLabels: Record<string, string> = {
  idea: "想法",
  evidence: "证据",
  experiment: "实验",
  building: "构建",
  launched: "发布",
  revenue: "收入",
  systemized: "系统化"
};

export function AssetsPage() {
  const assets = useQuery({ queryKey: ["assets"], queryFn: api.assets });
  if (assets.isLoading) return <LoadingState label="正在读取收入资产" />;
  if (assets.error) return <ErrorState error={assets.error} retry={() => assets.refetch()} />;
  const items = assets.data?.items ?? [];
  const totalRevenue = items.reduce((sum, asset) => sum + asset.monthlyRevenue, 0);
  const maintenance = items.reduce((sum, asset) => sum + asset.maintenanceHoursMonthly, 0);

  return (
    <div className="page-stack">
      <section className="asset-summary">
        <div><CurrencyCny size={25} weight="duotone" /><span>低维护月收入</span><strong>{formatMoney(totalRevenue)}</strong></div>
        <div><Clock size={25} weight="duotone" /><span>每月维护时间</span><strong>{maintenance} 小时</strong></div>
        <div><Wrench size={25} weight="duotone" /><span>正在验证</span><strong>{items.filter((asset) => ["evidence", "experiment", "building"].includes(asset.stage)).length} 个资产</strong></div>
      </section>
      <SectionHeader title="资产漏斗" description="收入不是唯一指标。维护负担决定它是否真正接近睡后收入。" />
      <div className="asset-stage-rail" aria-label="收入资产阶段">
        {stages.map((stage, index) => <div key={stage}><span>{stageLabels[stage]}</span>{index < stages.length - 1 ? <ArrowRight size={14} /> : null}</div>)}
      </div>
      {items.length === 0 ? <EmptyState title="还没有收入资产" body="从客户交付或成功实验中提取第一个可复用资产。" /> : (
        <div className="asset-list">
          {items.map((asset) => (
            <article className="asset-row" key={asset.id}>
              <div className="asset-icon"><Cube size={23} weight="duotone" /></div>
              <div className="asset-name"><span>{stageLabels[asset.stage]}</span><h2>{asset.name}</h2><p>{asset.revenueModel}</p></div>
              <div><span>月收入</span><strong>{formatMoney(asset.monthlyRevenue)}</strong></div>
              <div><span>月维护</span><strong>{asset.maintenanceHoursMonthly} 小时</strong></div>
              <div className="asset-next"><span>下一步</span><strong>{asset.nextAction}</strong></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
