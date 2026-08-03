import type { CashflowForecastInput, FinanceTransaction, MonthlyFinanceSummary, RunStatus } from "@personal-os/vnext-contracts";

export const terminalRunStatuses = new Set<RunStatus>(["succeeded", "partially_succeeded", "failed", "cancelled"]);

const transitions: Record<RunStatus, ReadonlySet<RunStatus>> = {
  queued: new Set(["running", "cancelled", "failed"]),
  running: new Set(["waiting_input", "waiting_approval", "succeeded", "partially_succeeded", "failed", "cancelled"]),
  waiting_input: new Set(["running", "cancelled", "failed"]),
  waiting_approval: new Set(["running", "cancelled", "failed"]),
  succeeded: new Set(),
  partially_succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set()
};

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!transitions[from].has(to)) throw new Error(`INVALID_RUN_TRANSITION:${from}->${to}`);
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return terminalRunStatuses.has(status);
}

export function canRetryRun(status: RunStatus): boolean {
  return status === "failed" || status === "cancelled" || status === "partially_succeeded";
}

export function scheduleFiringKey(scheduleId: string, scheduledFor: string): string {
  return `${scheduleId}:${scheduledFor}`;
}

const sensitiveKey = /token|secret|password|authorization|api[_-]?key|cookie|密码|密钥/i;
const inlineSecret = /((?:api[_ -]?key|token|secret|password|authorization|cookie|密码|密钥)\s*[:=：]\s*)([^\s,;，；]+)/giu;

export function redactSensitiveText(value: string): string {
  return value.replace(inlineSecret, (match, prefix: string, secret: string) => secret.startsWith("//") ? match : `${prefix}[REDACTED]`);
}

export function redactSensitiveValue(value: unknown, exactSecrets: string[] = []): unknown {
  if (typeof value === "string") {
    let redacted = redactSensitiveText(value);
    for (const secret of exactSecrets.filter(Boolean)) redacted = redacted.replaceAll(secret, "[REDACTED]");
    return redacted;
  }
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValue(item, exactSecrets));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) =>
    sensitiveKey.test(key) && typeof item !== "number" ? [key, "[REDACTED]"] : [key, redactSensitiveValue(item, exactSecrets)]
  ));
}

export function summarizeMonth(
  transactions: FinanceTransaction[],
  month: string,
  currency: string
): MonthlyFinanceSummary {
  const selected = transactions.filter((item) =>
    item.deletedAt === null && item.currency === currency && item.occurredAt.slice(0, 7) === month
  );
  const incomeMinor = selected.reduce((sum, item) => sum + (item.reportingType === "income" ? item.reportingEffectMinor : 0), 0);
  const expenseMinor = selected.reduce((sum, item) => sum + (item.reportingType === "expense" ? item.reportingEffectMinor : 0), 0);
  return { month, currency, incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
}

export function convertMinorUnits(amountMinor: number, rateNumerator: number, rateDenominator: number): number {
  assertPositiveSafeInteger(amountMinor, "INVALID_AMOUNT");
  assertPositiveSafeInteger(rateNumerator, "INVALID_RATE_NUMERATOR");
  assertPositiveSafeInteger(rateDenominator, "INVALID_RATE_DENOMINATOR");
  const numerator = BigInt(amountMinor) * BigInt(rateNumerator);
  const denominator = BigInt(rateDenominator);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("FINANCE_INTEGER_OVERFLOW");
  return Number(rounded);
}

export function transactionFacts(transactionType: "income" | "expense", amountMinor: number): {
  balanceEffectMinor: number;
  reportingType: "income" | "expense";
  reportingEffectMinor: number;
} {
  assertPositiveSafeInteger(amountMinor, "INVALID_AMOUNT");
  return transactionType === "income"
    ? { balanceEffectMinor: amountMinor, reportingType: "income", reportingEffectMinor: amountMinor }
    : { balanceEffectMinor: -amountMinor, reportingType: "expense", reportingEffectMinor: amountMinor };
}

export interface CashflowForecastPoint {
  month: string;
  openingBalanceMinor: number;
  expectedIncomeMinor: number;
  expectedExpenseMinor: number;
  closingBalanceMinor: number;
}

export function calculateCashflowForecast(input: CashflowForecastInput): { points: CashflowForecastPoint[]; closingBalanceMinor: number } {
  let balance = assertSafeInteger(input.openingBalanceMinor, "INVALID_OPENING_BALANCE");
  const points = input.months.map((month) => {
    const openingBalanceMinor = balance;
    balance = safeAdd(safeAdd(balance, month.expectedIncomeMinor), -month.expectedExpenseMinor);
    return { month: month.month, openingBalanceMinor, expectedIncomeMinor: month.expectedIncomeMinor, expectedExpenseMinor: month.expectedExpenseMinor, closingBalanceMinor: balance };
  });
  return { points, closingBalanceMinor: balance };
}

export function calculateBudgetVariance(plannedMinor: number, actualMinor: number): number {
  assertSafeInteger(plannedMinor, "INVALID_PLANNED_AMOUNT");
  assertSafeInteger(actualMinor, "INVALID_ACTUAL_AMOUNT");
  return safeAdd(plannedMinor, -actualMinor);
}

export function safeAdd(left: number, right: number): number {
  assertSafeInteger(left, "FINANCE_INTEGER_OVERFLOW");
  assertSafeInteger(right, "FINANCE_INTEGER_OVERFLOW");
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error("FINANCE_INTEGER_OVERFLOW");
  return result;
}

function assertPositiveSafeInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
}

function assertSafeInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(code);
  return value;
}
