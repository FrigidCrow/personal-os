import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link, useLocation } from "wouter";
import { Dialog, Theme } from "@radix-ui/themes";
import {
  CheckSquare,
  CirclesFour,
  Command,
  Crosshair,
  Cube,
  Flask,
  House,
  List,
  HardDrives,
  Monitor,
  Moon,
  Robot,
  Sun,
  X,
  type Icon
} from "@phosphor-icons/react";
import { SuccessToastProvider } from "./SuccessToast";

type ThemeMode = "light" | "dark" | "system";

interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: Icon;
}

const navItems: NavItem[] = [
  { to: "/", label: "总览", description: "今天需要判断的事", icon: House },
  { to: "/projects", label: "项目", description: "现金流与交付组合", icon: CirclesFour },
  { to: "/tasks", label: "任务", description: "工作队列与下一步", icon: CheckSquare },
  { to: "/radar", label: "机会雷达", description: "证据与最小测试", icon: Crosshair },
  { to: "/experiments", label: "实验室", description: "验证成功或及时停止", icon: Flask },
  { to: "/assets", label: "收入资产", description: "低维护收入漏斗", icon: Cube },
  { to: "/review", label: "Agent 控制", description: "运行、审批与人工验收", icon: Robot }
];

const titles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "今天的控制面", subtitle: "先处理判断，再处理执行。" },
  "/projects": { title: "项目组合", subtitle: "现金流、系统化、资产和个人运营放在同一张图上。" },
  "/tasks": { title: "任务队列", subtitle: "每个活跃事项都应该有可执行的下一步。" },
  "/radar": { title: "机会雷达", subtitle: "只保留有证据、可低成本验证的赚钱假设。" },
  "/experiments": { title: "微型实验室", subtitle: "限制投入，尽快获得真实市场反馈。" },
  "/assets": { title: "收入资产", subtitle: "同时衡量收入、复用程度和每月维护时间。" },
  "/review": { title: "Agent 控制面", subtitle: "查看自动执行，批准高风险动作，验收最终结果。" }
};

function resolveSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const reduceMotion = useReducedMotion();
  return (
    <>
      <div className="brand-lockup">
        <motion.div
          className="brand-mark"
          aria-hidden="true"
          whileHover={reduceMotion ? undefined : { rotate: -8, scale: 1.06 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
        ><Command weight="bold" size={21} /></motion.div>
        <div>
          <strong>Personal OS</strong>
          <span>Private command system</span>
        </div>
      </div>
      <nav className="primary-nav" aria-label="主导航">
        {navItems.map(({ to, label, description, icon: NavIcon }) => {
          const active = location === to || (to !== "/" && location.startsWith(`${to}/`));
          return (
            <Link
              key={to}
              href={to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`nav-link${active ? " active" : ""}`}
            >
              {active ? <motion.span className="nav-active-plane" layoutId="primary-nav-active" transition={{ type: "spring", stiffness: 360, damping: 30 }} /> : null}
              <NavIcon size={21} weight={active ? "fill" : "duotone"} aria-hidden="true" />
              <span className="nav-copy"><strong>{label}</strong><small>{description}</small></span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-note">
        <HardDrives size={19} weight="duotone" aria-hidden="true" />
        <div>
          <strong>本机数据</strong>
          <p>SQLite 连接正常</p>
        </div>
      </div>
    </>
  );
}

function ThemeSelector({ value, onChange }: { value: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  const options: Array<{ value: ThemeMode; label: string; icon: Icon }> = [
    { value: "light", label: "浅色", icon: Sun },
    { value: "dark", label: "深色", icon: Moon },
    { value: "system", label: "系统", icon: Monitor }
  ];
  return (
    <div className="theme-selector" role="radiogroup" aria-label="主题">
      {options.map(({ value: option, label, icon: ThemeIcon }) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={value === option ? "selected" : ""}
          onClick={() => onChange(option)}
          title={label}
        >
          <ThemeIcon size={16} weight="bold" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("personal-os-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(resolveSystemTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setSystemTheme(resolveSystemTheme());
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    localStorage.setItem("personal-os-theme", themeMode);
  }, [themeMode]);

  const appearance = themeMode === "system" ? systemTheme : themeMode;
  const page = useMemo(() => titles[location] ?? (location.startsWith("/projects/") ? { title: "项目详情", subtitle: "把结果、上下文和执行任务放在同一页。" } : titles["/"]!), [location]);
  const dateLabel = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date());

  return (
    <Theme appearance={appearance} accentColor="orange" grayColor="sand" radius="large" scaling="100%">
      <SuccessToastProvider><div className="app-shell" data-theme-mode={appearance}>
        <div className="ambient-field" aria-hidden="true"><span /><span /><span /></div>
        <aside className="desktop-sidebar"><NavContent /></aside>

        <div className="app-stage">
          <header className="app-header">
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger>
                <button className="icon-button mobile-menu-button" type="button" aria-label="打开导航">
                  <List size={22} weight="bold" />
                </button>
              </Dialog.Trigger>
              <Dialog.Content className="mobile-nav-dialog" aria-describedby={undefined}>
                <Dialog.Title className="sr-only">导航</Dialog.Title>
                <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="关闭导航">
                  <X size={20} weight="bold" />
                </button>
                <NavContent onNavigate={() => setMobileOpen(false)} />
              </Dialog.Content>
            </Dialog.Root>

            <div className="page-heading">
              <h1>{page.title}</h1>
              <p>{page.subtitle}</p>
            </div>
            <div className="header-actions">
              <div className="local-state"><HardDrives size={15} weight="duotone" /><span>LOCAL</span></div>
              <time>{dateLabel}</time>
              <ThemeSelector value={themeMode} onChange={setThemeMode} />
            </div>
          </header>
          <main className="app-main">{children}</main>
        </div>
      </div></SuccessToastProvider>
    </Theme>
  );
}
