import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, FileCode, Robot, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { api } from "../api";
import { EmptyState, ErrorState, LoadingState, SectionHeader, StatusBadge } from "../components/UI";

export function ReviewPage() {
  const queryClient = useQueryClient();
  const runs = useQuery({ queryKey: ["runs"], queryFn: api.runs, refetchInterval: 4000 });
  const accept = useMutation({
    mutationFn: api.acceptRun,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });

  if (runs.isLoading) return <LoadingState label="正在读取 Codex 运行记录" />;
  if (runs.error) return <ErrorState error={runs.error} retry={() => runs.refetch()} />;
  const items = runs.data?.items ?? [];

  return (
    <div className="page-stack">
      <section className="review-principle">
        <ShieldCheck size={26} weight="duotone" />
        <div><strong>人工批准是完成条件</strong><p>Codex 可以执行、测试并提交结果，但不能自行把任务标记为最终完成。</p></div>
      </section>
      <SectionHeader title="执行记录" description="Demo 与 Live 结果始终明确区分。" />
      {items.length === 0 ? <EmptyState title="没有等待审查的结果" body="从 Ready 任务中选择一个可委派事项。" /> : (
        <div className="review-list">
          {items.map((run) => (
            <article className="review-run" key={run.id}>
              <header>
                <div className="run-avatar"><Robot size={22} weight="duotone" /></div>
                <div><span>{run.mode === "demo" ? "Demo 适配器" : "Live Codex"}</span><h2>{run.promptSnapshot}</h2></div>
                <StatusBadge status={run.status} demo={run.mode === "demo"} />
              </header>
              {run.mode === "demo" ? <div className="run-warning"><WarningCircle size={17} weight="fill" />该结果由确定性 Demo 适配器生成，只用于验证工作流。</div> : null}
              <div className="run-result">
                <div><span>执行结果</span><p>{run.finalResponse ?? "任务仍在运行，完成后会在这里显示摘要。"}</p></div>
                <div><span>验证摘要</span><p>{run.verificationSummary ?? "尚未提交验证摘要。"}</p></div>
              </div>
              {run.artifactPaths.length > 0 ? <div className="artifact-list">{run.artifactPaths.map((path) => <span key={path}><FileCode size={15} />{path}</span>)}</div> : null}
              <footer>
                <span>Run {run.id.slice(0, 8)}</span>
                {run.status === "needs_review" ? <button className="primary-button" onClick={() => accept.mutate(run.id)} disabled={accept.isPending}><CheckCircle size={17} weight="fill" />批准结果</button> : null}
              </footer>
            </article>
          ))}
        </div>
      )}
      {accept.error ? <p className="inline-error">{accept.error.message}</p> : null}
    </div>
  );
}
