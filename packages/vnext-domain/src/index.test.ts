import { describe, expect, it } from "vitest";
import { assertRunTransition, calculateCashflowForecast, canRetryRun, convertMinorUnits, redactSensitiveText, redactSensitiveValue, scheduleFiringKey, summarizeMonth } from "./index.js";
import type { FinanceTransaction } from "@personal-os/vnext-contracts";

describe("vNext run state machine", () => {
  it.each([
    ["queued", "running"],
    ["running", "waiting_input"],
    ["running", "waiting_approval"],
    ["running", "succeeded"],
    ["waiting_input", "running"]
  ] as const)("allows %s -> %s", (from, to) => expect(() => assertRunTransition(from, to)).not.toThrow());

  it.each([
    ["queued", "succeeded"],
    ["succeeded", "running"],
    ["failed", "queued"],
    ["cancelled", "succeeded"]
  ] as const)("rejects %s -> %s", (from, to) => expect(() => assertRunTransition(from, to)).toThrow("INVALID_RUN_TRANSITION"));

  it("allows retries only from recoverable terminal states", () => {
    expect(canRetryRun("failed")).toBe(true);
    expect(canRetryRun("cancelled")).toBe(true);
    expect(canRetryRun("succeeded")).toBe(false);
    expect(canRetryRun("running")).toBe(false);
  });
});

describe("vNext domain calculations", () => {
  it("redacts structured and free-text secrets while preserving references", () => {
    expect(redactSensitiveText("API key: abc123, secret://openworker/default")).toBe("API key: [REDACTED], secret://openworker/default");
    expect(redactSensitiveValue({ password: "hidden", nested: "token=abc123", reference: "secret://openworker/default" })).toEqual({
      password: "[REDACTED]",
      nested: "token=[REDACTED]",
      reference: "secret://openworker/default"
    });
  });

  it("creates stable schedule firing keys", () => {
    expect(scheduleFiringKey("schedule-1", "2026-08-01T00:00:00.000Z")).toBe("schedule-1:2026-08-01T00:00:00.000Z");
  });

  it("summarizes integer minor units and ignores deleted transactions", () => {
    const base = { accountId: "a", currency: "CNY", occurredAt: "2026-08-01T00:00:00.000Z", categoryId: null, category: null, counterparty: null, description: "", parentTransactionId: null, transferId: null, reversalOfTransactionId: null, createdAt: "", updatedAt: "" };
    const transactions: FinanceTransaction[] = [
      { ...base, id: "1", transactionType: "income", amountMinor: 10_001, balanceEffectMinor: 10_001, reportingType: "income", reportingEffectMinor: 10_001, deletedAt: null },
      { ...base, id: "2", transactionType: "expense", amountMinor: 2_005, balanceEffectMinor: -2_005, reportingType: "expense", reportingEffectMinor: 2_005, deletedAt: null },
      { ...base, id: "3", transactionType: "income", amountMinor: 99_999, balanceEffectMinor: 99_999, reportingType: "income", reportingEffectMinor: 99_999, deletedAt: "2026-08-02T00:00:00.000Z" },
      { ...base, id: "4", transactionType: "transfer_in", amountMinor: 50_000, balanceEffectMinor: 50_000, reportingType: "transfer", reportingEffectMinor: 0, deletedAt: null }
    ];
    expect(summarizeMonth(transactions, "2026-08", "CNY")).toEqual({ month: "2026-08", currency: "CNY", incomeMinor: 10_001, expenseMinor: 2_005, netMinor: 7_996 });
  });

  it.each([
    [100, 1, 3, 33],
    [101, 1, 2, 51],
    [100, 7, 3, 233]
  ])("converts %i with rational rate %i/%i", (amount, numerator, denominator, expected) => {
    expect(convertMinorUnits(amount, numerator, denominator)).toBe(expected);
  });

  it("rejects non-integer and overflowing authoritative amounts", () => {
    expect(() => convertMinorUnits(10.5, 1, 1)).toThrow("INVALID_AMOUNT");
    expect(() => convertMinorUnits(Number.MAX_SAFE_INTEGER, 2, 1)).toThrow("FINANCE_INTEGER_OVERFLOW");
  });

  it("replays an explicit cashflow snapshot without floating point amounts", () => {
    const input = { currency: "CNY", openingBalanceMinor: 10_000, months: [{ month: "2026-08", expectedIncomeMinor: 5_000, expectedExpenseMinor: 2_000 }, { month: "2026-09", expectedIncomeMinor: 0, expectedExpenseMinor: 1_500 }] };
    expect(calculateCashflowForecast(input)).toEqual({ points: [
      { month: "2026-08", openingBalanceMinor: 10_000, expectedIncomeMinor: 5_000, expectedExpenseMinor: 2_000, closingBalanceMinor: 13_000 },
      { month: "2026-09", openingBalanceMinor: 13_000, expectedIncomeMinor: 0, expectedExpenseMinor: 1_500, closingBalanceMinor: 11_500 }
    ], closingBalanceMinor: 11_500 });
  });
});
