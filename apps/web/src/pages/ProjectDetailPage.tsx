import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarBlank, CurrencyCny, FolderOpen, GitBranch, Note } from "@phosphor-icons/react";
import { Link, useRoute } from "wouter";
import { api } from "../api";
import { EmptyState, ErrorState, formatDate, formatMoney, LoadingState, StatusBadge, laneLabels } from "../components/UI";

export function ProjectDetailPage() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id ?? "";
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => api.project(projectId), enabled: Boolean(projectId) });

  if (project.isLoading) return <LoadingState label="正在读取项目详情" />;
  if (project.error) return <ErrorState error={project.error} retry={() => project.refetch()} />;
  if (!project.data) return <EmptyState title="项目不存在" body="这个项目可能已经被删除。" action={<Link className="secondary-button" href="/projects"><ArrowLeft size={16} />返回项目列表</Link>} />;

  const data = project.data;
  return (
    <div className="page-stack project-detail-page">
      <Link className="back-link" href="/projects"><ArrowLeft size={16} />返回项目组合</Link>

      <section className="project-detail-hero">
        <div className="project-detail-heading">
          <div className="project-icon"><FolderOpen size={24} weight="duotone" /></div>
          <div><span>{laneLabels[data.lane]}</span><h2>{data.name}</h2></div>
          <StatusBadge status={data.status} />
        </div>
        <div className="project-detail-outcome"><span>目标结果</span><p>{data.outcome}</p></div>
        <div className="project-detail-next"><span>唯一下一步</span><strong>{data.nextAction}</strong></div>
      </section>

      <section className="project-detail-context" aria-label="项目上下文">
        <div><CalendarBlank size={19} weight="duotone" /><span>截止日期</span><strong>{formatDate(data.deadline)}</strong></div>
        <div><CurrencyCny size={19} weight="duotone" /><span>预期收入</span><strong>{formatMoney(data.expectedRevenue ?? 0)}</strong></div>
        <div><CurrencyCny size={19} weight="duotone" /><span>实际收入</span><strong>{formatMoney(data.actualRevenue ?? 0)}</strong></div>
      </section>

      <section className="project-detail-paths">
        <div><GitBranch size={19} weight="duotone" /><span>Git 仓库</span><code>{data.repositoryPath ?? "未连接"}</code></div>
        <div><Note size={19} weight="duotone" /><span>Obsidian 笔记</span><code>{data.obsidianPath ?? "未连接"}</code></div>
      </section>

      <section className="project-task-section">
        <header><div><h2>关联任务</h2><p>这个项目当前共有 {data.tasks.length} 项任务。</p></div><Link className="secondary-button" href="/tasks">打开任务看板<ArrowRight size={16} /></Link></header>
        {data.tasks.length === 0 ? <EmptyState title="还没有关联任务" body="创建任务时选择这个项目，它会出现在这里。" /> : (
          <div className="project-task-list">
            {data.tasks.map((task) => (
              <Link className="project-task-row" href="/tasks" key={task.id}>
                <div><span className="priority-text" data-priority={task.priority}>{task.priority}</span><h3>{task.title}</h3><p>{task.description || "尚未补充说明。"}</p></div>
                <div><StatusBadge status={task.status} /><span>{formatDate(task.dueDate)}</span><ArrowRight size={16} /></div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
