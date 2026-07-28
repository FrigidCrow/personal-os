import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import type { CodexRunStatus, ProjectLane, ProjectStatus, TaskStatus } from "@personal-os/domain";

const statusLabels: Record<TaskStatus | ProjectStatus | CodexRunStatus, string> = {
  inbox: "待分类",
  ready: "可执行",
  in_progress: "进行中",
  needs_review: "待审查",
  done: "已完成",
  blocked: "受阻",
  planned: "已计划",
  active: "活跃",
  paused: "已暂停",
  completed: "已结束",
  archived: "已归档",
  queued: "排队中",
  claimed: "已领取",
  running: "运行中",
  awaiting_approval: "等待审批",
  failed: "失败",
  cancelled: "已取消"
};

export const laneLabels: Record<ProjectLane, string> = {
  cash_now: "Cash Now",
  systemize: "Systemize",
  assets: "Assets",
  life_ops: "Life & Ops"
};

export function StatusBadge({ status, demo }: { status: keyof typeof statusLabels; demo?: boolean }) {
  return <motion.span layout className={`status-badge status-${status}`}>{statusLabels[status]}{demo ? " / Demo" : ""}</motion.span>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div className="section-header" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
      <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      {action ? <div className="section-action">{action}</div> : null}
    </motion.div>
  );
}

export function AnimatedValue({ value, format = (current) => Math.round(current).toLocaleString("zh-CN") }: { value: number; format?: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!ref.current) return;
    if (reduceMotion) {
      ref.current.textContent = format(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (current) => {
        if (ref.current) ref.current.textContent = format(current);
      },
      onComplete: () => {
        if (ref.current) ref.current.textContent = format(value);
      }
    });
    return () => controls.stop();
  }, [format, reduceMotion, value]);

  return <span ref={ref}>{format(value)}</span>;
}

export function LoadingState({ label = "正在读取本地状态" }: { label?: string }) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <div className="skeleton-lines" aria-hidden="true"><span /><span /><span /></div>
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="state-panel state-error" role="alert">
      <WarningCircle size={28} weight="duotone" aria-hidden="true" />
      <div><strong>暂时无法读取数据</strong><p>{error.message}</p></div>
      {retry ? <button className="secondary-button" onClick={retry}><ArrowClockwise size={16} />重试</button> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><strong>{title}</strong><p>{body}</p>{action}</div>;
}

export function DemoBanner() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div className="demo-banner" role="note" initial={reduceMotion ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12, duration: 0.45 }}>
      <WarningCircle size={18} weight="fill" aria-hidden="true" />
      <span>当前包含演示数据。机会证据和收入数字仅用于界面验收，采取行动前必须替换为真实资料。</span>
    </motion.div>
  );
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
