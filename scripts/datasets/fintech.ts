import { faker } from "@faker-js/faker";

const SEED = 20260916;

export const FINTECH_ROW_COUNTS = {
  customers: 250,
};

const REGIONS = ["north", "south", "midwest", "west"] as const;
const RISK_SEGMENTS = ["low", "medium", "high"] as const;
const ACCOUNT_TYPES = ["checking", "savings", "credit"] as const;
const ACCOUNT_STATUS_WEIGHTS = [
  { value: "active", weight: 9 },
  { value: "closed", weight: 1 },
] as const;
type AccountStatus = (typeof ACCOUNT_STATUS_WEIGHTS)[number]["value"];
const TRANSACTION_TYPES = ["debit", "credit"] as const;
const TRANSACTION_CATEGORIES = [
  "groceries",
  "rent",
  "utilities",
  "entertainment",
  "transfer",
  "salary",
] as const;
const LOAN_STATUS_WEIGHTS = [
  { value: "current", weight: 6 },
  { value: "paid_off", weight: 3 },
  { value: "default", weight: 1 },
] as const;
type LoanStatus = (typeof LOAN_STATUS_WEIGHTS)[number]["value"];
const LOAN_PAYMENT_STATUS_WEIGHTS = [
  { value: "on_time", weight: 8 },
  { value: "late", weight: 1.5 },
  { value: "missed", weight: 0.5 },
] as const;
type LoanPaymentStatus = (typeof LOAN_PAYMENT_STATUS_WEIGHTS)[number]["value"];

export interface FintechCustomer {
  customerId: number;
  joinedAt: Date;
  region: (typeof REGIONS)[number];
  riskSegment: (typeof RISK_SEGMENTS)[number];
}

export interface FintechAccount {
  accountId: number;
  customerId: number;
  accountType: (typeof ACCOUNT_TYPES)[number];
  openedAt: Date;
  status: AccountStatus;
}

export interface Transaction {
  transactionId: number;
  accountId: number;
  occurredAt: Date;
  amount: number;
  type: (typeof TRANSACTION_TYPES)[number];
  category: (typeof TRANSACTION_CATEGORIES)[number];
}

export interface Loan {
  loanId: number;
  customerId: number;
  originatedAt: Date;
  principal: number;
  interestRate: number;
  status: LoanStatus;
}

export interface LoanPayment {
  paymentId: number;
  loanId: number;
  paidAt: Date;
  amount: number;
  status: LoanPaymentStatus;
}

export interface FintechDataset {
  customers: FintechCustomer[];
  accounts: FintechAccount[];
  transactions: Transaction[];
  loans: Loan[];
  loanPayments: LoanPayment[];
}

/** Deterministic (fixed seed) synthetic fintech dataset — the one shared Dataset for the fintech Domain (ADR 0001). */
export function generateFintechDataset(): FintechDataset {
  faker.seed(SEED);

  const customers: FintechCustomer[] = Array.from(
    { length: FINTECH_ROW_COUNTS.customers },
    (_, i) => ({
      customerId: i + 1,
      joinedAt: faker.date.between({ from: "2021-01-01", to: "2025-06-01" }),
      region: faker.helpers.arrayElement(REGIONS),
      riskSegment: faker.helpers.arrayElement(RISK_SEGMENTS),
    }),
  );

  const accounts: FintechAccount[] = [];
  for (const customer of customers) {
    const accountCount = faker.helpers.weightedArrayElement([
      { value: 1, weight: 6 },
      { value: 2, weight: 3 },
      { value: 3, weight: 1 },
    ]);
    for (let i = 0; i < accountCount; i++) {
      accounts.push({
        accountId: accounts.length + 1,
        customerId: customer.customerId,
        accountType: faker.helpers.arrayElement(ACCOUNT_TYPES),
        openedAt: faker.date.soon({ days: 60 * (i + 1), refDate: customer.joinedAt }),
        status: faker.helpers.weightedArrayElement(ACCOUNT_STATUS_WEIGHTS),
      });
    }
  }

  const transactions: Transaction[] = [];
  for (const account of accounts) {
    const transactionCount = faker.number.int({ min: 5, max: 60 });
    for (let i = 0; i < transactionCount; i++) {
      transactions.push({
        transactionId: transactions.length + 1,
        accountId: account.accountId,
        occurredAt: faker.date.between({ from: account.openedAt, to: "2025-09-01" }),
        amount: faker.number.float({ min: 5, max: 3000, fractionDigits: 2 }),
        type: faker.helpers.arrayElement(TRANSACTION_TYPES),
        category: faker.helpers.arrayElement(TRANSACTION_CATEGORIES),
      });
    }
  }

  const loans: Loan[] = [];
  for (const customer of customers) {
    const hasLoan = faker.datatype.boolean({ probability: 0.4 });
    if (!hasLoan) continue;

    const originatedAt = faker.date.soon({ days: 200, refDate: customer.joinedAt });
    loans.push({
      loanId: loans.length + 1,
      customerId: customer.customerId,
      originatedAt,
      principal: faker.number.float({ min: 1000, max: 50000, fractionDigits: 2 }),
      interestRate: faker.number.float({ min: 0.03, max: 0.22, fractionDigits: 4 }),
      status: faker.helpers.weightedArrayElement(LOAN_STATUS_WEIGHTS),
    });
  }

  const loanPayments: LoanPayment[] = [];
  for (const loan of loans) {
    const installments = faker.number.int({ min: 3, max: 24 });
    for (let i = 0; i < installments; i++) {
      loanPayments.push({
        paymentId: loanPayments.length + 1,
        loanId: loan.loanId,
        paidAt: faker.date.soon({ days: 30 * (i + 1), refDate: loan.originatedAt }),
        amount: Number((loan.principal / installments).toFixed(2)),
        status: faker.helpers.weightedArrayElement(LOAN_PAYMENT_STATUS_WEIGHTS),
      });
    }
  }

  return { customers, accounts, transactions, loans, loanPayments };
}
