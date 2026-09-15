import { faker } from "@faker-js/faker";

const SEED = 20260915;

export const SAAS_ROW_COUNTS = {
  accounts: 200,
  plans: 5,
};

const REGIONS = ["north", "south", "midwest", "west"] as const;
const SEGMENTS = ["smb", "mid_market", "enterprise"] as const;
const BILLING_INTERVALS = ["monthly", "annual"] as const;
type SubscriptionStatus = "trial" | "active" | "canceled";
const INVOICE_STATUS_WEIGHTS = [
  { value: "paid", weight: 9 },
  { value: "failed", weight: 1 },
  { value: "pending", weight: 1 },
] as const;
type InvoiceStatus = (typeof INVOICE_STATUS_WEIGHTS)[number]["value"];
const EVENT_TYPES = ["login", "feature_used", "api_call", "report_exported"] as const;

export interface Account {
  accountId: number;
  signedUpAt: Date;
  region: (typeof REGIONS)[number];
  segment: (typeof SEGMENTS)[number];
}

export interface Plan {
  planId: number;
  name: string;
  monthlyPrice: number;
  billingInterval: (typeof BILLING_INTERVALS)[number];
}

export interface Subscription {
  subscriptionId: number;
  accountId: number;
  planId: number;
  startedAt: Date;
  endedAt: Date | null;
  status: SubscriptionStatus;
}

export interface Invoice {
  invoiceId: number;
  accountId: number;
  subscriptionId: number;
  issuedAt: Date;
  amount: number;
  status: InvoiceStatus;
}

export interface UsageEvent {
  eventId: number;
  accountId: number;
  eventType: (typeof EVENT_TYPES)[number];
  occurredAt: Date;
  quantity: number;
}

export interface SaasDataset {
  accounts: Account[];
  plans: Plan[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  usageEvents: UsageEvent[];
}

const PLAN_NAMES = ["Starter", "Growth", "Scale", "Enterprise", "Enterprise Plus"];

/** Deterministic (fixed seed) synthetic SaaS dataset — the one shared Dataset for the saas Domain (ADR 0001). */
export function generateSaasDataset(): SaasDataset {
  faker.seed(SEED);

  const plans: Plan[] = PLAN_NAMES.slice(0, SAAS_ROW_COUNTS.plans).map((name, i) => ({
    planId: i + 1,
    name,
    monthlyPrice: 29 * 2 ** i,
    billingInterval: faker.helpers.arrayElement(BILLING_INTERVALS),
  }));

  const accounts: Account[] = Array.from(
    { length: SAAS_ROW_COUNTS.accounts },
    (_, i) => ({
      accountId: i + 1,
      signedUpAt: faker.date.between({ from: "2022-01-01", to: "2025-06-01" }),
      region: faker.helpers.arrayElement(REGIONS),
      segment: faker.helpers.arrayElement(SEGMENTS),
    }),
  );

  const subscriptions: Subscription[] = [];
  for (const account of accounts) {
    const initialPlan = faker.helpers.arrayElement(plans);
    const startedAt = account.signedUpAt;
    const upgrades = faker.helpers.weightedArrayElement([
      { value: 0, weight: 7 },
      { value: 1, weight: 3 },
    ]);
    const churnedAfterFirst = upgrades === 0 && faker.datatype.boolean({ probability: 0.2 });

    const firstEndedAt =
      upgrades > 0 || churnedAfterFirst
        ? faker.date.soon({ days: 180, refDate: startedAt })
        : null;

    subscriptions.push({
      subscriptionId: subscriptions.length + 1,
      accountId: account.accountId,
      planId: initialPlan.planId,
      startedAt,
      endedAt: firstEndedAt,
      status: firstEndedAt === null ? "active" : churnedAfterFirst ? "canceled" : "active",
    });

    if (upgrades > 0 && firstEndedAt) {
      const secondPlan = faker.helpers.arrayElement(plans);
      subscriptions.push({
        subscriptionId: subscriptions.length + 1,
        accountId: account.accountId,
        planId: secondPlan.planId,
        startedAt: firstEndedAt,
        endedAt: null,
        status: "active",
      });
    }
  }

  const invoices: Invoice[] = [];
  for (const subscription of subscriptions) {
    const plan = plans.find((p) => p.planId === subscription.planId)!;
    const cycles = faker.number.int({ min: 1, max: 8 });
    for (let i = 0; i < cycles; i++) {
      invoices.push({
        invoiceId: invoices.length + 1,
        accountId: subscription.accountId,
        subscriptionId: subscription.subscriptionId,
        issuedAt: faker.date.soon({
          days: 30 * (i + 1),
          refDate: subscription.startedAt,
        }),
        amount: plan.monthlyPrice,
        status: faker.helpers.weightedArrayElement(INVOICE_STATUS_WEIGHTS),
      });
    }
  }

  const usageEvents: UsageEvent[] = [];
  for (const account of accounts) {
    const eventCount = faker.number.int({ min: 5, max: 60 });
    for (let i = 0; i < eventCount; i++) {
      usageEvents.push({
        eventId: usageEvents.length + 1,
        accountId: account.accountId,
        eventType: faker.helpers.arrayElement(EVENT_TYPES),
        occurredAt: faker.date.between({ from: account.signedUpAt, to: "2025-09-01" }),
        quantity: faker.number.int({ min: 1, max: 20 }),
      });
    }
  }

  return { accounts, plans, subscriptions, invoices, usageEvents };
}
