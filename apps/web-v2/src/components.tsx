import type { ReactNode } from "react";
import { WarningCircleIcon, TrayIcon } from "@phosphor-icons/react";

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function LoadingBlock({ label = "正在读取本地数据" }: { label?: string }) {
  return <div className="state-block" aria-live="polite"><div className="skeleton-lines"><span /><span /><span /></div><p>{label}</p></div>;
}

export function ErrorBlock({ error }: { error: unknown }) {
  return <div className="state-block error-state" role="alert"><WarningCircleIcon size={22} weight="duotone" /><strong>加载失败</strong><p>{error instanceof Error ? error.message : "暂时无法读取数据。"}</p></div>;
}

export function EmptyBlock({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="state-block empty-state"><TrayIcon size={28} weight="duotone" /><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function Status({ value }: { value: string }) {
  const tone = ["succeeded", "active", "healthy"].includes(value) ? "positive" : ["failed", "critical"].includes(value) ? "negative" : ["running", "queued"].includes(value) ? "accent" : "neutral";
  return <span className={`status status-${tone}`}>{statusLabel(value)}</span>;
}

export function statusLabel(value: string): string {
  const labels: Record<string, string> = { queued: "排队中", running: "运行中", waiting_input: "等待输入", waiting_approval: "等待审批", succeeded: "成功", partially_succeeded: "部分成功", failed: "失败", cancelled: "已取消", active: "已启用", paused: "已暂停", archived: "已归档", draft: "草稿", retired: "已停用", healthy: "正常" };
  return labels[value] ?? value;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function money(minor: number, currency = "CNY"): string {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(minor / 100);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
