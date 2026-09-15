import { describe, expect, it } from "vitest";
import { FINTECH_ROW_COUNTS, generateFintechDataset } from "../fintech";

describe("generateFintechDataset", () => {
  it("is deterministic given the fixed seed", () => {
    expect(generateFintechDataset()).toEqual(generateFintechDataset());
  });

  it("produces the configured row counts", () => {
    const data = generateFintechDataset();

    expect(data.customers).toHaveLength(FINTECH_ROW_COUNTS.customers);
    expect(data.accounts.length).toBeGreaterThanOrEqual(data.customers.length);
    expect(data.loans.length).toBeGreaterThan(0);
    expect(data.loanPayments.length).toBeGreaterThan(data.loans.length);
  });

  it("keeps every foreign key resolvable to its parent table", () => {
    const data = generateFintechDataset();
    const customerIds = new Set(data.customers.map((c) => c.customerId));
    const accountIds = new Set(data.accounts.map((a) => a.accountId));
    const loanIds = new Set(data.loans.map((l) => l.loanId));

    for (const account of data.accounts) {
      expect(customerIds.has(account.customerId)).toBe(true);
    }
    for (const transaction of data.transactions) {
      expect(accountIds.has(transaction.accountId)).toBe(true);
    }
    for (const loan of data.loans) {
      expect(customerIds.has(loan.customerId)).toBe(true);
    }
    for (const payment of data.loanPayments) {
      expect(loanIds.has(payment.loanId)).toBe(true);
    }
  });

  it("keeps loan payments on or after loan origination", () => {
    const data = generateFintechDataset();
    const loanById = new Map(data.loans.map((l) => [l.loanId, l]));

    for (const payment of data.loanPayments) {
      const loan = loanById.get(payment.loanId)!;
      expect(payment.paidAt.getTime()).toBeGreaterThanOrEqual(loan.originatedAt.getTime());
    }
  });
});
