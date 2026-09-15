import { describe, expect, it } from "vitest";
import { SAAS_ROW_COUNTS, generateSaasDataset } from "../saas";

describe("generateSaasDataset", () => {
  it("is deterministic given the fixed seed", () => {
    expect(generateSaasDataset()).toEqual(generateSaasDataset());
  });

  it("produces the configured row counts", () => {
    const data = generateSaasDataset();

    expect(data.accounts).toHaveLength(SAAS_ROW_COUNTS.accounts);
    expect(data.plans).toHaveLength(SAAS_ROW_COUNTS.plans);
    expect(data.subscriptions.length).toBeGreaterThanOrEqual(data.accounts.length);
    expect(data.usageEvents.length).toBeGreaterThan(data.accounts.length);
  });

  it("keeps every foreign key resolvable to its parent table", () => {
    const data = generateSaasDataset();
    const accountIds = new Set(data.accounts.map((a) => a.accountId));
    const planIds = new Set(data.plans.map((p) => p.planId));
    const subscriptionIds = new Set(data.subscriptions.map((s) => s.subscriptionId));

    for (const subscription of data.subscriptions) {
      expect(accountIds.has(subscription.accountId)).toBe(true);
      expect(planIds.has(subscription.planId)).toBe(true);
    }
    for (const invoice of data.invoices) {
      expect(accountIds.has(invoice.accountId)).toBe(true);
      expect(subscriptionIds.has(invoice.subscriptionId)).toBe(true);
    }
    for (const event of data.usageEvents) {
      expect(accountIds.has(event.accountId)).toBe(true);
    }
  });

  it("never ends a subscription before it started", () => {
    const data = generateSaasDataset();
    for (const subscription of data.subscriptions) {
      if (subscription.endedAt) {
        expect(subscription.endedAt.getTime()).toBeGreaterThan(
          subscription.startedAt.getTime(),
        );
      }
    }
  });
});
