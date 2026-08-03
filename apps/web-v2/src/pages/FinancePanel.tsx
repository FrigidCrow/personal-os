import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  BankIcon,
  CalculatorIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  ClockIcon,
  CoinsIcon,
  PlusIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  TargetIcon,
  WalletIcon,
  XIcon
} from "@phosphor-icons/react";
import type {
  FinanceAccount,
  FinanceAllocation,
  FinanceBudget,
  FinanceCalculation,
  FinanceCategory,
  FinanceChangeProposal,
  FinanceTransaction,
  FinanceTransferResult,
  MonthlyFinanceSummary,
  OperatingEntry,
  OperatingUnit,
  OperatingUnitSummary
} from "@personal-os/vnext-contracts";
import { api, post } from "../api";
import { EmptyBlock, ErrorBlock, Field, LoadingBlock, errorMessage, formatDate, money } from "../components";

type FinanceView = "overview" | "accounts" | "transactions" | "budgets" | "forecast" | "operations" | "proposals";
type FinanceForm = "account" | "transaction" | "transfer" | "refund" | "category" | "budget" | "forecast" | "unit" | "allocation" | "entry" | "proposal" | null;

const views: Array<{ id: FinanceView; label: string; icon: typeof WalletIcon }> = [
  { id: "overview", label: "概览", icon: WalletIcon },
  { id: "accounts", label: "账户", icon: BankIcon },
  { id: "transactions", label: "交易", icon: ReceiptIcon },
  { id: "budgets", label: "预算", icon: TargetIcon },
  { id: "forecast", label: "预测", icon: ChartLineUpIcon },
  { id: "operations", label: "经营归因", icon: CoinsIcon },
  { id: "proposals", label: "待审批", icon: ShieldCheckIcon }
];

export function FinancePanel() {
  const client = useQueryClient();
  const [view, setView] = useState<FinanceView>("overview");
  const [form, setForm] = useState<FinanceForm>(null);
  const [targetTransactionId, setTargetTransactionId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const month = new Date().toISOString().slice(0, 7);
  const currency = "CNY";

  const accounts = useQuery({ queryKey: ["finance-accounts"], queryFn: () => api<FinanceAccount[]>("/finance/accounts") });
  const transactions = useQuery({ queryKey: ["finance-transactions"], queryFn: () => api<FinanceTransaction[]>("/finance/transactions") });
  const categories = useQuery({ queryKey: ["finance-categories"], queryFn: () => api<FinanceCategory[]>("/finance/categories") });
  const budgets = useQuery({ queryKey: ["finance-budgets", month, currency], queryFn: () => api<FinanceBudget[]>(`/finance/budgets?month=${month}&currency=${currency}`) });
  const calculations = useQuery({ queryKey: ["finance-calculations"], queryFn: () => api<FinanceCalculation[]>("/finance/calculations") });
  const units = useQuery({ queryKey: ["finance-operating-units"], queryFn: () => api<OperatingUnit[]>("/finance/operating-units") });
  const allocations = useQuery({ queryKey: ["finance-allocations"], queryFn: () => api<FinanceAllocation[]>("/finance/allocations") });
  const entries = useQuery({ queryKey: ["finance-operating-entries"], queryFn: () => api<OperatingEntry[]>("/finance/operating-entries") });
  const proposals = useQuery({ queryKey: ["finance-change-proposals"], queryFn: () => api<FinanceChangeProposal[]>("/finance/change-proposals") });
  const summary = useQuery({ queryKey: ["finance-summary", month, currency], queryFn: () => api<MonthlyFinanceSummary>(`/finance/summary/monthly?month=${month}&currency=${currency}`) });
  const selectedUnit = selectedUnitId ?? units.data?.[0]?.id ?? null;
  const operatingSummary = useQuery({ queryKey: ["finance-operating-summary", selectedUnit], queryFn: () => api<OperatingUnitSummary>(`/finance/operating-units/${selectedUnit}/summary`), enabled: Boolean(selectedUnit) });

  const refresh = async () => { await Promise.all([
    client.invalidateQueries({ queryKey: ["finance-accounts"] }), client.invalidateQueries({ queryKey: ["finance-transactions"] }),
    client.invalidateQueries({ queryKey: ["finance-categories"] }), client.invalidateQueries({ queryKey: ["finance-budgets"] }),
    client.invalidateQueries({ queryKey: ["finance-calculations"] }), client.invalidateQueries({ queryKey: ["finance-operating-units"] }),
    client.invalidateQueries({ queryKey: ["finance-allocations"] }), client.invalidateQueries({ queryKey: ["finance-operating-entries"] }),
    client.invalidateQueries({ queryKey: ["finance-operating-summary"] }), client.invalidateQueries({ queryKey: ["finance-change-proposals"] }),
    client.invalidateQueries({ queryKey: ["finance-summary"] })
  ]); };
  const completed = (message: string) => { setNotice(message); setForm(null); setTargetTransactionId(null); void refresh(); window.setTimeout(() => setNotice(""), 4_000); };

  const createAccount = useMutation({ mutationFn: (input: unknown) => post<FinanceAccount>("/finance/accounts", input), onSuccess: () => completed("账户已保存") });
  const createTransaction = useMutation({ mutationFn: (input: unknown) => post<FinanceTransaction>("/finance/transactions", input), onSuccess: () => completed("收支已记录") });
  const createTransfer = useMutation({ mutationFn: (input: unknown) => post<FinanceTransferResult>("/finance/transfers", input), onSuccess: () => completed("转账两端已原子入账") });
  const createRefund = useMutation({ mutationFn: (input: unknown) => post<FinanceTransaction>("/finance/refunds", input), onSuccess: () => completed("退款已关联原交易") });
  const createCategory = useMutation({ mutationFn: (input: unknown) => post<FinanceCategory>("/finance/categories", input), onSuccess: () => completed("分类已创建") });
  const saveBudget = useMutation({ mutationFn: (input: unknown) => post<FinanceBudget>("/finance/budgets", input), onSuccess: () => completed("预算已保存并保留审计") });
  const createForecast = useMutation({ mutationFn: (input: unknown) => post<FinanceCalculation>("/finance/calculations/cashflow", input), onSuccess: () => completed("预测快照已保存") });
  const createUnit = useMutation({ mutationFn: (input: unknown) => post<OperatingUnit>("/finance/operating-units", input), onSuccess: (unit) => { setSelectedUnitId(unit.id); completed("经营单元已创建"); } });
  const createAllocation = useMutation({ mutationFn: (input: unknown) => post<FinanceAllocation>("/finance/allocations", input), onSuccess: () => completed("现金事实已归因") });
  const createEntry = useMutation({ mutationFn: (input: unknown) => post<OperatingEntry>("/finance/operating-entries", input), onSuccess: () => completed("经营计划项已记录") });
  const createProposal = useMutation({ mutationFn: (input: unknown) => post<FinanceChangeProposal>("/finance/change-proposals", input), onSuccess: () => { setView("proposals"); completed("变更已进入审批，不会立即修改现金事实"); } });
  const decideProposal = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => post<FinanceChangeProposal>(`/finance/change-proposals/${id}/resolve`, { decision, comment: decision === "approved" ? "在财务工作台批准" : "在财务工作台拒绝" }), onSuccess: (_, variables) => completed(variables.decision === "approved" ? "审批已执行并保留历史" : "提议已拒绝，现金事实未变化") });

  const queries = [accounts, transactions, categories, budgets, calculations, units, allocations, entries, proposals, summary];
  const firstError = queries.find((query) => query.error)?.error;
  if (queries.some((query) => query.isLoading)) return <LoadingBlock label="正在核对财务事实与计划" />;
  if (firstError) return <ErrorBlock error={firstError} />;

  const activeTransactions = (transactions.data ?? []).filter((item) => item.deletedAt === null);
  const pending = (proposals.data ?? []).filter((item) => item.status === "pending");
  const target = activeTransactions.find((item) => item.id === targetTransactionId) ?? null;
  const mutationError = [createAccount, createTransaction, createTransfer, createRefund, createCategory, saveBudget, createForecast, createUnit, createAllocation, createEntry, createProposal, decideProposal].find((mutation) => mutation.error)?.error;
  const isSaving = [createAccount, createTransaction, createTransfer, createRefund, createCategory, saveBudget, createForecast, createUnit, createAllocation, createEntry, createProposal, decideProposal].some((mutation) => mutation.isPending);

  const showForTransaction = (next: "refund" | "proposal", transaction: FinanceTransaction) => { setTargetTransactionId(transaction.id); setForm(next); };

  return <div className="finance-workspace">
    <div className="finance-commandbar">
      <nav aria-label="财务工作区">{views.map((item) => { const Icon = item.icon; return <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setForm(null); }}><Icon />{item.label}{item.id === "proposals" && pending.length > 0 ? <em>{pending.length}</em> : null}</button>; })}</nav>
      <button className="button primary" onClick={() => setForm("transaction")}><PlusIcon />记录收支</button>
    </div>

    {notice && <div className="finance-notice" role="status"><CheckCircleIcon weight="fill" />{notice}</div>}
    {mutationError && <div className="finance-alert" role="alert"><strong>操作没有保存</strong><span>{errorMessage(mutationError, "请核对输入后重试")}</span><button aria-label="关闭错误" onClick={() => [createAccount, createTransaction, createTransfer, createRefund, createCategory, saveBudget, createForecast, createUnit, createAllocation, createEntry, createProposal, decideProposal].forEach((mutation) => mutation.reset())}><XIcon /></button></div>}

    <FinanceFormPanel form={form} target={target} accounts={accounts.data ?? []} categories={categories.data ?? []} transactions={activeTransactions} units={units.data ?? []} pending={isSaving} onClose={() => { setForm(null); setTargetTransactionId(null); }} handlers={{ createAccount: (value) => createAccount.mutate(value), createTransaction: (value) => createTransaction.mutate(value), createTransfer: (value) => createTransfer.mutate(value), createRefund: (value) => createRefund.mutate(value), createCategory: (value) => createCategory.mutate(value), saveBudget: (value) => saveBudget.mutate(value), createForecast: (value) => createForecast.mutate(value), createUnit: (value) => createUnit.mutate(value), createAllocation: (value) => createAllocation.mutate(value), createEntry: (value) => createEntry.mutate(value), createProposal: (value) => createProposal.mutate(value) }} />

    {view === "overview" && <Overview summary={summary.data!} accounts={accounts.data ?? []} transactions={activeTransactions} pending={pending.length} onNavigate={setView} />}
    {view === "accounts" && <AccountsView accounts={accounts.data ?? []} onAdd={() => setForm("account")} />}
    {view === "transactions" && <TransactionsView transactions={activeTransactions} onAdd={() => setForm("transaction")} onTransfer={() => setForm("transfer")} onRefund={(item) => showForTransaction("refund", item)} onPropose={(item) => showForTransaction("proposal", item)} />}
    {view === "budgets" && <BudgetsView budgets={budgets.data ?? []} categories={categories.data ?? []} currency={currency} onCategory={() => setForm("category")} onBudget={() => setForm("budget")} />}
    {view === "forecast" && <ForecastView calculations={calculations.data ?? []} onCreate={() => setForm("forecast")} />}
    {view === "operations" && <OperationsView units={units.data ?? []} selectedUnitId={selectedUnit} summary={operatingSummary.data ?? null} allocations={allocations.data ?? []} entries={entries.data ?? []} onSelect={setSelectedUnitId} onUnit={() => setForm("unit")} onAllocation={() => setForm("allocation")} onEntry={() => setForm("entry")} />}
    {view === "proposals" && <ProposalsView proposals={proposals.data ?? []} transactions={activeTransactions} pending={decideProposal.isPending} onDecision={(id, decision) => decideProposal.mutate({ id, decision })} />}
  </div>;
}

function Overview({ summary, accounts, transactions, pending, onNavigate }: { summary: MonthlyFinanceSummary; accounts: FinanceAccount[]; transactions: FinanceTransaction[]; pending: number; onNavigate(view: FinanceView): void }) {
  return <div className="finance-overview">
    <section className="finance-summary"><Metric label="本月收入" value={money(summary.incomeMinor, summary.currency)} /><Metric label="本月支出" value={money(summary.expenseMinor, summary.currency)} /><Metric label="净现金流" value={money(summary.netMinor, summary.currency)} accent /><button className="finance-review-card" onClick={() => onNavigate("proposals")}><ShieldCheckIcon /><span>待审批提议<strong>{pending}</strong><small>历史事实只有批准后才会变化</small></span></button></section>
    <div className="finance-grid"><section className="panel finance-panel"><SectionTitle title="最近交易" description="转账不计入收入和支出。" action={<button className="text-button" onClick={() => onNavigate("transactions")}>查看全部</button>} />{transactions.length === 0 ? <EmptyBlock title="还没有交易" description="先记录一笔真实收支。" /> : <TransactionRows transactions={transactions.slice(0, 8)} />}</section><section className="panel finance-panel"><SectionTitle title="账户余额" description="余额由不可覆盖的交易事实推导。" action={<button className="text-button" onClick={() => onNavigate("accounts")}>管理账户</button>} /><AccountRows accounts={accounts} /></section></div>
  </div>;
}

function AccountsView({ accounts, onAdd }: { accounts: FinanceAccount[]; onAdd(): void }) { return <section className="panel finance-panel"><SectionTitle title="账户" description="微信、支付宝、银行卡和现金按币种独立记账。" action={<button className="button primary" onClick={onAdd}><PlusIcon />添加账户</button>} />{accounts.length ? <AccountRows accounts={accounts} cards /> : <EmptyBlock title="还没有账户" description="添加账户后才能记录收支和转账。" />}</section>; }

function TransactionsView({ transactions, onAdd, onTransfer, onRefund, onPropose }: { transactions: FinanceTransaction[]; onAdd(): void; onTransfer(): void; onRefund(item: FinanceTransaction): void; onPropose(item: FinanceTransaction): void }) {
  return <section className="panel finance-panel"><SectionTitle title="交易事实" description="删除、修改与冲销必须进入审批，原记录不会被覆盖。" action={<div className="row-actions"><button className="button secondary" onClick={onTransfer}><ArrowsLeftRightIcon />账户转账</button><button className="button primary" onClick={onAdd}><PlusIcon />记录收支</button></div>} />{transactions.length === 0 ? <EmptyBlock title="还没有交易" description="记录第一笔收支后，退款与归因能力会在这里出现。" /> : <div className="finance-table">{transactions.map((item) => <article key={item.id}><TransactionIdentity transaction={item} /><TransactionAmount transaction={item} /><div className="row-actions">{(item.transactionType === "income" || item.transactionType === "expense") && <><button className="button secondary small" onClick={() => onRefund(item)}><ArrowCounterClockwiseIcon />退款</button><button className="button secondary small" onClick={() => onPropose(item)}>提议变更</button></>}</div></article>)}</div>}</section>;
}

function BudgetsView({ budgets, categories, currency, onCategory, onBudget }: { budgets: FinanceBudget[]; categories: FinanceCategory[]; currency: string; onCategory(): void; onBudget(): void }) {
  const categoryMap = new Map(categories.map((item) => [item.id, item.name]));
  return <div className="finance-grid"><section className="panel finance-panel"><SectionTitle title="本月预算" description="预算是计划，不会伪装成现金事实。" action={<button className="button primary" disabled={!categories.length} onClick={onBudget}><PlusIcon />设置预算</button>} />{budgets.length ? <div className="budget-list">{budgets.map((item) => <div key={item.id}><span><strong>{categoryMap.get(item.categoryId) ?? "未知分类"}</strong><small>{item.month} · {item.currency}</small></span><strong>{money(item.plannedMinor, currency)}</strong></div>)}</div> : <EmptyBlock title="本月还没有预算" description={categories.length ? "为分类设置计划额度。" : "先创建一个财务分类。"} />}</section><section className="panel finance-panel"><SectionTitle title="收支分类" description="分类停用后仍保留历史引用。" action={<button className="button secondary" onClick={onCategory}><PlusIcon />新建分类</button>} /><div className="category-cloud">{categories.map((item) => <span key={item.id}>{item.name}<small>{kindLabel(item.kind)}</small></span>)}{categories.length === 0 && <p className="quiet">还没有分类。</p>}</div></section></div>;
}

function ForecastView({ calculations, onCreate }: { calculations: FinanceCalculation[]; onCreate(): void }) {
  const forecasts = calculations.filter((item) => item.calculationType === "cashflow_forecast");
  return <section className="panel finance-panel"><SectionTitle title="现金流预测" description="每次预测都保存期初余额、逐月假设、公式版本和结果，可随时重放。" action={<button className="button primary" onClick={onCreate}><ChartLineUpIcon />新建预测</button>} />{forecasts.length === 0 ? <EmptyBlock title="还没有预测快照" description="用明确假设生成第一份可复现预测。" /> : <div className="calculation-grid">{forecasts.map((item) => { const result = item.result as { closingBalanceMinor?: number; points?: Array<{ month: string; closingBalanceMinor: number }> }; return <article key={item.id}><span><CalculatorIcon />{item.formulaVersion}</span><strong>{money(result.closingBalanceMinor ?? 0, item.currency)}</strong><small>{result.points?.length ?? 0} 个月 · {formatDate(item.createdAt)}</small></article>; })}</div>}</section>;
}

function OperationsView({ units, selectedUnitId, summary, allocations, entries, onSelect, onUnit, onAllocation, onEntry }: { units: OperatingUnit[]; selectedUnitId: string | null; summary: OperatingUnitSummary | null; allocations: FinanceAllocation[]; entries: OperatingEntry[]; onSelect(id: string): void; onUnit(): void; onAllocation(): void; onEntry(): void }) {
  const selected = units.find((item) => item.id === selectedUnitId);
  return <div className="operations-layout"><aside className="panel finance-panel"><SectionTitle title="经营单元" description="项目、雷达与产品都可以独立核算投入产出。" action={<button className="icon-button" aria-label="新增经营单元" onClick={onUnit}><PlusIcon /></button>} /><div className="unit-list">{units.map((unit) => <button key={unit.id} className={selectedUnitId === unit.id ? "selected" : ""} onClick={() => onSelect(unit.id)}><span><strong>{unit.name}</strong><small>{unitTypeLabel(unit.unitType)} · {unit.currency}</small></span><TargetIcon /></button>)}{units.length === 0 && <p className="quiet">还没有经营单元。</p>}</div></aside><section className="panel finance-panel operations-detail">{!selected || !summary ? <EmptyBlock title="选择经营单元" description="创建或选择一个单元后查看实际现金、计划金额和时间投入。" /> : <><SectionTitle title={selected.name} description="实际现金、预期金额与投入时间分栏呈现。" action={<div className="row-actions"><button className="button secondary" onClick={onEntry}><ClockIcon />记录计划或时间</button><button className="button primary" onClick={onAllocation}><CoinsIcon />分摊交易</button></div>} /><div className="operating-metrics"><Metric label="实际收入" value={money(summary.actualIncomeMinor, summary.currency)} /><Metric label="实际支出" value={money(summary.actualExpenseMinor, summary.currency)} /><Metric label="预期收入" value={money(summary.expectedIncomeMinor, summary.currency)} /><Metric label="承诺成本" value={money(summary.committedCostMinor, summary.currency)} /><Metric label="投入时间" value={`${summary.timeMinutes} 分钟`} /></div><div className="operations-ledger"><div><h3>现金归因</h3><strong>{allocations.filter((item) => item.operatingUnitId === selected.id).length}</strong><small>笔已分摊交易</small></div><div><h3>计划与时间</h3><strong>{entries.filter((item) => item.operatingUnitId === selected.id).length}</strong><small>条独立经营记录</small></div></div></>}</section></div>;
}

function ProposalsView({ proposals, transactions, pending, onDecision }: { proposals: FinanceChangeProposal[]; transactions: FinanceTransaction[]; pending: boolean; onDecision(id: string, decision: "approved" | "rejected"): void }) {
  const transactionMap = new Map(transactions.map((item) => [item.id, item]));
  return <section className="panel finance-panel"><SectionTitle title="财务变更审批" description="first-decision-wins。拒绝不会改变余额，批准会在同一事务中完成。" />{proposals.length === 0 ? <EmptyBlock title="没有待审批变更" description="需要修改、删除或冲销交易时，从交易列表发起提议。" /> : <div className="proposal-list">{proposals.map((proposal) => <article key={proposal.id}><header><span className={`status ${proposal.status === "pending" ? "status-accent" : proposal.status === "approved" ? "status-positive" : "status-negative"}`}>{proposalStatusLabel(proposal.status)}</span><small>{proposal.requestedBy === "runtime" ? "Runtime 提议" : "本人提议"} · {formatDate(proposal.createdAt)}</small></header><h3>{proposalTypeLabel(proposal.proposalType)} · {transactionMap.get(proposal.targetTransactionId)?.description || proposal.targetTransactionId.slice(0, 8)}</h3><p>{proposal.rationale}</p>{proposal.status === "pending" && <div className="row-actions"><button className="button primary small" disabled={pending} onClick={() => onDecision(proposal.id, "approved")}>批准并执行</button><button className="button danger small" disabled={pending} onClick={() => onDecision(proposal.id, "rejected")}>拒绝</button></div>}</article>)}</div>}</section>;
}
interface FormHandlers { [key: string]: (value: unknown) => void }
function FinanceFormPanel({ form, target, accounts, categories, transactions, units, pending, onClose, handlers }: { form: FinanceForm; target: FinanceTransaction | null; accounts: FinanceAccount[]; categories: FinanceCategory[]; transactions: FinanceTransaction[]; units: OperatingUnit[]; pending: boolean; onClose(): void; handlers: FormHandlers }) {
  if (!form) return null;
  const title = ({ account: "添加账户", transaction: "记录收支", transfer: "账户转账", refund: "登记退款", category: "创建分类", budget: "设置月度预算", forecast: "创建现金流预测", unit: "创建经营单元", allocation: "分摊真实交易", entry: "记录计划或时间", proposal: "发起财务变更" } as Record<Exclude<FinanceForm, null>, string>)[form];
  return <section className="editor-panel finance-editor"><SectionTitle title={title} description="所有金额最终以最小货币单位安全整数保存。" action={<button className="icon-button" aria-label="关闭表单" onClick={onClose}><XIcon /></button>} />
    {form === "account" && <AccountForm pending={pending} onSubmit={handlers.createAccount!} />}
    {form === "transaction" && <TransactionForm accounts={accounts} categories={categories} pending={pending} onSubmit={handlers.createTransaction!} />}
    {form === "transfer" && <TransferForm accounts={accounts} pending={pending} onSubmit={handlers.createTransfer!} />}
    {form === "refund" && target && <RefundForm transaction={target} pending={pending} onSubmit={handlers.createRefund!} />}
    {form === "category" && <CategoryForm pending={pending} onSubmit={handlers.createCategory!} />}
    {form === "budget" && <BudgetForm categories={categories} pending={pending} onSubmit={handlers.saveBudget!} />}
    {form === "forecast" && <ForecastForm pending={pending} onSubmit={handlers.createForecast!} />}
    {form === "unit" && <UnitForm pending={pending} onSubmit={handlers.createUnit!} />}
    {form === "allocation" && <AllocationForm transactions={transactions} units={units} pending={pending} onSubmit={handlers.createAllocation!} />}
    {form === "entry" && <EntryForm units={units} pending={pending} onSubmit={handlers.createEntry!} />}
    {form === "proposal" && target && <ProposalForm transaction={target} pending={pending} onSubmit={handlers.createProposal!} />}
  </section>;
}

function AccountForm({ pending, onSubmit }: SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ name: data.get("name"), accountType: data.get("accountType"), currency: data.get("currency"), initialBalanceMinor: toMinor(data.get("initialBalance"), true), institution: textOrNull(data.get("institution")) }))}><Field label="账户名称"><input name="name" required /></Field><Field label="账户类型"><select name="accountType"><option value="bank">银行卡</option><option value="virtual">微信 / 支付宝</option><option value="cash">现金</option><option value="receivable">应收</option><option value="payable">应付</option><option value="investment">投资</option></select></Field><Field label="币种"><input name="currency" defaultValue="CNY" minLength={3} maxLength={3} required /></Field><MoneyInput label="期初余额" name="initialBalance" defaultValue="0.00" signed /><Field label="机构"><input name="institution" /></Field><Submit pending={pending} label="保存账户" /></form>; }

function TransactionForm({ accounts, categories, pending, onSubmit }: { accounts: FinanceAccount[]; categories: FinanceCategory[] } & SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => { const account = accounts.find((item) => item.id === data.get("accountId")); const category = categories.find((item) => item.id === data.get("categoryId")); onSubmit({ accountId: data.get("accountId"), transactionType: data.get("transactionType"), amountMinor: toMinor(data.get("amount")), currency: account?.currency ?? "CNY", occurredAt: localDate(data.get("occurredAt")), categoryId: category?.id ?? null, category: category?.name ?? null, counterparty: textOrNull(data.get("counterparty")), description: data.get("description") ?? "" }); })}><Field label="账户"><select name="accountId" required>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currency}</option>)}</select></Field><Field label="类型"><select name="transactionType"><option value="income">收入</option><option value="expense">支出</option></select></Field><MoneyInput label="金额" name="amount" /><DateInput /><Field label="分类"><select name="categoryId"><option value="">未分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="交易对方"><input name="counterparty" /></Field><Field label="说明"><input name="description" required /></Field><Submit pending={pending || accounts.length === 0} label="保存收支" /></form>; }

function TransferForm({ accounts, pending, onSubmit }: { accounts: FinanceAccount[] } & SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ fromAccountId: data.get("fromAccountId"), toAccountId: data.get("toAccountId"), fromAmountMinor: toMinor(data.get("fromAmount")), toAmountMinor: toMinor(data.get("toAmount")), occurredAt: localDate(data.get("occurredAt")), rateNumerator: integerOrNull(data.get("rateNumerator")), rateDenominator: integerOrNull(data.get("rateDenominator")), description: data.get("description") ?? "" }))}><Field label="转出账户"><select name="fromAccountId" required>{accounts.map(accountOption)}</select></Field><Field label="转入账户"><select name="toAccountId" required>{accounts.map(accountOption)}</select></Field><MoneyInput label="转出金额" name="fromAmount" /><MoneyInput label="转入金额" name="toAmount" /><Field label="汇率分子" hint="跨币种必填"><input name="rateNumerator" inputMode="numeric" pattern="[0-9]+" /></Field><Field label="汇率分母" hint="跨币种必填"><input name="rateDenominator" inputMode="numeric" pattern="[0-9]+" /></Field><DateInput /><Field label="说明"><input name="description" required /></Field><Submit pending={pending || accounts.length < 2} label="原子入账" /></form>; }

function RefundForm({ transaction, pending, onSubmit }: { transaction: FinanceTransaction } & SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ originalTransactionId: transaction.id, amountMinor: toMinor(data.get("amount")), occurredAt: localDate(data.get("occurredAt")), description: data.get("description") ?? "" }))}><ReadOnlyFact label="原交易" value={`${transaction.description || "未命名交易"} · ${money(transaction.amountMinor, transaction.currency)}`} /><MoneyInput label="退款金额" name="amount" /><DateInput /><Field label="说明"><input name="description" required defaultValue="部分退款" /></Field><Submit pending={pending} label="登记退款" /></form>; }

function CategoryForm({ pending, onSubmit }: SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ name: data.get("name"), kind: data.get("kind") }))}><Field label="分类名称"><input name="name" required /></Field><Field label="适用类型"><select name="kind"><option value="expense">支出</option><option value="income">收入</option><option value="both">收入与支出</option></select></Field><Submit pending={pending} label="创建分类" /></form>; }

function BudgetForm({ categories, pending, onSubmit }: { categories: FinanceCategory[] } & SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ month: data.get("month"), currency: data.get("currency"), categoryId: data.get("categoryId"), plannedMinor: toMinor(data.get("planned"), true) }))}><Field label="月份"><input name="month" type="month" defaultValue={new Date().toISOString().slice(0, 7)} required /></Field><Field label="币种"><input name="currency" defaultValue="CNY" minLength={3} maxLength={3} required /></Field><Field label="分类"><select name="categoryId" required>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><MoneyInput label="计划金额" name="planned" allowZero /><Submit pending={pending || categories.length === 0} label="保存预算" /></form>; }

function ForecastForm({ pending, onSubmit }: SimpleFormProps) { const nextMonth = monthOffset(1); const secondMonth = monthOffset(2); return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ currency: data.get("currency"), openingBalanceMinor: toMinor(data.get("openingBalance"), true), months: [{ month: data.get("month1"), expectedIncomeMinor: toMinor(data.get("income1"), true), expectedExpenseMinor: toMinor(data.get("expense1"), true) }, { month: data.get("month2"), expectedIncomeMinor: toMinor(data.get("income2"), true), expectedExpenseMinor: toMinor(data.get("expense2"), true) }] }))}><Field label="币种"><input name="currency" defaultValue="CNY" minLength={3} maxLength={3} required /></Field><MoneyInput label="期初余额" name="openingBalance" signed /><Field label="第一个月"><input name="month1" type="month" defaultValue={nextMonth} required /></Field><MoneyInput label="预计收入" name="income1" allowZero /><MoneyInput label="预计支出" name="expense1" allowZero /><Field label="第二个月"><input name="month2" type="month" defaultValue={secondMonth} required /></Field><MoneyInput label="预计收入" name="income2" allowZero /><MoneyInput label="预计支出" name="expense2" allowZero /><Submit pending={pending} label="保存预测快照" /></form>; }

function UnitForm({ pending, onSubmit }: SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ name: data.get("name"), unitType: data.get("unitType"), referenceId: textOrNull(data.get("referenceId")), currency: data.get("currency") }))}><Field label="名称"><input name="name" required /></Field><Field label="类型"><select name="unitType"><option value="project">项目</option><option value="radar">雷达</option><option value="product">产品</option><option value="custom">自定义</option></select></Field><Field label="关联 ID"><input name="referenceId" /></Field><Field label="币种"><input name="currency" defaultValue="CNY" minLength={3} maxLength={3} required /></Field><Submit pending={pending} label="创建经营单元" /></form>; }

function AllocationForm({ transactions, units, pending, onSubmit }: { transactions: FinanceTransaction[]; units: OperatingUnit[] } & SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ transactionId: data.get("transactionId"), operatingUnitId: data.get("operatingUnitId"), amountMinor: toMinor(data.get("amount")), idempotencyKey: `ui:${String(data.get("transactionId"))}:${String(data.get("operatingUnitId"))}` }))}><Field label="真实交易"><select name="transactionId" required>{transactions.filter((item) => item.reportingType === "income" || item.reportingType === "expense").map((item) => <option key={item.id} value={item.id}>{item.description || item.id.slice(0, 8)} · {money(item.amountMinor, item.currency)}</option>)}</select></Field><Field label="经营单元"><select name="operatingUnitId" required>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><MoneyInput label="分摊金额" name="amount" /><Submit pending={pending || !transactions.length || !units.length} label="保存归因" /></form>; }

function EntryForm({ units, pending, onSubmit }: { units: OperatingUnit[] } & SimpleFormProps) {
  const [entryType, setEntryType] = useState("expected_income");
  const isTime = entryType === "time";
  return <form className="form-grid" onSubmit={submitForm((data) => onSubmit({ operatingUnitId: data.get("operatingUnitId"), entryType, amountMinor: isTime ? null : toMinor(data.get("amount")), currency: isTime ? null : data.get("currency"), minutes: isTime ? Number(data.get("minutes")) : null, description: data.get("description") ?? "", occurredAt: localDate(data.get("occurredAt")) }))}><Field label="经营单元"><select name="operatingUnitId" required>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="记录类型"><select name="entryType" value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="expected_income">预期收入</option><option value="committed_cost">承诺成本</option><option value="time">投入时间</option></select></Field><MoneyInput label="金额" name="amount" optional={isTime} /><Field label="币种"><input name="currency" defaultValue="CNY" disabled={isTime} required={!isTime} /></Field><Field label="分钟"><input name="minutes" inputMode="numeric" pattern="[0-9]+" defaultValue="60" disabled={!isTime} required={isTime} /></Field><DateInput /><Field label="说明"><input name="description" required /></Field><Submit pending={pending || !units.length} label="记录经营项" /></form>;
}

function ProposalForm({ transaction, pending, onSubmit }: { transaction: FinanceTransaction } & SimpleFormProps) { return <form className="form-grid" onSubmit={submitForm((data) => { const proposalType = String(data.get("proposalType")); const amount = String(data.get("amount") ?? "").trim(); onSubmit({ targetTransactionId: transaction.id, proposalType, proposedChanges: proposalType === "update" ? { ...(amount ? { amountMinor: toMinor(amount) } : {}), ...(String(data.get("description") ?? "").trim() ? { description: data.get("description") } : {}) } : {}, rationale: data.get("rationale") }); })}><ReadOnlyFact label="目标交易" value={`${transaction.description || "未命名交易"} · ${money(transaction.amountMinor, transaction.currency)}`} /><Field label="变更类型"><select name="proposalType"><option value="update">修改并保留历史</option><option value="reverse">冲销</option><option value="delete">逻辑删除</option></select></Field><MoneyInput label="修改后的金额" name="amount" optional /><Field label="修改后的说明"><input name="description" /></Field><Field label="理由"><textarea name="rationale" required rows={3} /></Field><Submit pending={pending} label="提交审批" /></form>; }

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className={accent ? "finance-metric accent" : "finance-metric"}><span>{label}</span><strong>{value}</strong></div>; }
function SectionTitle({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div>{action}</div>; }
function AccountRows({ accounts, cards = false }: { accounts: FinanceAccount[]; cards?: boolean }) { if (!accounts.length) return <p className="quiet">还没有账户。</p>; return <div className={cards ? "account-card-grid" : "account-list"}>{accounts.map((account) => <div key={account.id}><span><strong>{account.name}</strong><small>{account.institution || accountTypeLabel(account.accountType)} · {account.currency}</small></span><strong>{money(account.currentBalanceMinor, account.currency)}</strong></div>)}</div>; }
function TransactionRows({ transactions }: { transactions: FinanceTransaction[] }) { return <div className="transaction-list">{transactions.map((item) => <div key={item.id}><TransactionIdentity transaction={item} /><TransactionAmount transaction={item} /></div>)}</div>; }
function TransactionIdentity({ transaction }: { transaction: FinanceTransaction }) { return <div><strong>{transaction.description || transaction.category || transactionTypeLabel(transaction.transactionType)}</strong><small>{formatDate(transaction.occurredAt)} · {transactionTypeLabel(transaction.transactionType)}</small></div>; }
function TransactionAmount({ transaction }: { transaction: FinanceTransaction }) { const effect = transaction.balanceEffectMinor; return <span className={effect < 0 ? "expense" : effect > 0 ? "income" : "neutral"}>{effect > 0 ? "+" : ""}{money(effect, transaction.currency)}</span>; }
function ReadOnlyFact({ label, value }: { label: string; value: string }) { return <div className="readonly-fact"><span>{label}</span><strong>{value}</strong></div>; }
function MoneyInput({ label, name, defaultValue = "", signed = false, allowZero = false, optional = false }: { label: string; name: string; defaultValue?: string; signed?: boolean; allowZero?: boolean; optional?: boolean }) { const pattern = `${signed ? "-?" : ""}[0-9]+([.,][0-9]{1,2})?`; return <Field label={label}><input name={name} inputMode="decimal" pattern={pattern} defaultValue={defaultValue} required={!optional} minLength={allowZero ? 1 : undefined} placeholder="0.00" /></Field>; }
function DateInput() { return <Field label="发生时间"><input name="occurredAt" type="datetime-local" defaultValue={localNow()} required /></Field>; }
function Submit({ pending, label }: { pending: boolean; label: string }) { return <div className="finance-submit"><button className="button primary" disabled={pending}>{pending ? "正在保存" : label}</button></div>; }

interface SimpleFormProps { pending: boolean; onSubmit(value: unknown): void }
function submitForm(handler: (data: FormData) => void) { return (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); handler(new FormData(event.currentTarget)); }; }
function toMinor(value: FormDataEntryValue | null, signed = false): number { const raw = String(value ?? "").trim().replace(",", "."); const match = raw.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/); if (!match || (!signed && match[1] === "-")) throw new Error("INVALID_MONEY_INPUT"); const minor = BigInt(match[2]!) * 100n + BigInt((match[3] ?? "").padEnd(2, "0")); const result = Number(match[1] === "-" ? -minor : minor); if (!Number.isSafeInteger(result)) throw new Error("FINANCE_INTEGER_OVERFLOW"); return result; }
function textOrNull(value: FormDataEntryValue | null): string | null { const text = String(value ?? "").trim(); return text || null; }
function integerOrNull(value: FormDataEntryValue | null): number | null { const text = String(value ?? "").trim(); return text ? Number(text) : null; }
function localDate(value: FormDataEntryValue | null): string { return new Date(String(value)).toISOString(); }
function localNow(): string { return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function monthOffset(offset: number): string { const date = new Date(); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); }
function accountOption(account: FinanceAccount) { return <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>; }
function transactionTypeLabel(value: FinanceTransaction["transactionType"]): string { return ({ income: "收入", expense: "支出", refund: "退款", transfer_out: "转出", transfer_in: "转入", adjustment: "调整" } as const)[value]; }
function accountTypeLabel(value: FinanceAccount["accountType"]): string { return ({ cash: "现金", bank: "银行", credit_card: "信用卡", receivable: "应收", payable: "应付", investment: "投资", virtual: "数字钱包" } as const)[value]; }
function kindLabel(value: FinanceCategory["kind"]): string { return value === "both" ? "收支通用" : value === "income" ? "收入" : "支出"; }
function unitTypeLabel(value: OperatingUnit["unitType"]): string { return ({ project: "项目", radar: "雷达", product: "产品", custom: "自定义" } as const)[value]; }
function proposalStatusLabel(value: FinanceChangeProposal["status"]): string { return value === "pending" ? "待审批" : value === "approved" ? "已批准" : "已拒绝"; }
function proposalTypeLabel(value: FinanceChangeProposal["proposalType"]): string { return value === "update" ? "修改" : value === "delete" ? "逻辑删除" : "冲销"; }
