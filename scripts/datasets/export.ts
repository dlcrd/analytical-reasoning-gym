import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { generateEcommerceDataset } from "./ecommerce";
import { generateFintechDataset } from "./fintech";
import { generateSaasDataset } from "./saas";
import { sqlDate, sqlNumber, sqlString, sqlTimestamp } from "./sql-literals";

/** One table ready to load: column names plus each row already formatted as DuckDB SQL literals, in column order. */
export interface TableRows {
  columns: string[];
  rows: string[][];
}

/** Creates a table from literal rows (DuckDB infers column types from the literals) and copies it to a Parquet file. */
async function writeTable(
  connection: DuckDBConnection,
  tableName: string,
  table: TableRows,
  outFile: string,
) {
  const valuesList = table.rows.map((row) => `(${row.join(",")})`).join(",\n");
  await connection.run(
    `CREATE TABLE ${tableName} AS SELECT * FROM (VALUES\n${valuesList}\n) AS t(${table.columns.join(",")});`,
  );
  await connection.run(`COPY ${tableName} TO '${outFile.replace(/\\/g, "/")}' (FORMAT PARQUET);`);
}

function buildEcommerceTables(): Record<string, TableRows> {
  const data = generateEcommerceDataset();
  return {
    customers: {
      columns: ["customer_id", "signup_date", "region", "segment"],
      rows: data.customers.map((c) => [
        sqlNumber(c.customerId),
        sqlDate(c.signupDate),
        sqlString(c.region),
        sqlString(c.segment),
      ]),
    },
    products: {
      columns: ["product_id", "category", "price", "cost"],
      rows: data.products.map((p) => [
        sqlNumber(p.productId),
        sqlString(p.category),
        sqlNumber(p.price),
        sqlNumber(p.cost),
      ]),
    },
    orders: {
      columns: ["order_id", "customer_id", "order_date", "status", "channel"],
      rows: data.orders.map((o) => [
        sqlNumber(o.orderId),
        sqlNumber(o.customerId),
        sqlDate(o.orderDate),
        sqlString(o.status),
        sqlString(o.channel),
      ]),
    },
    order_items: {
      columns: [
        "order_item_id",
        "order_id",
        "product_id",
        "quantity",
        "unit_price",
        "discount",
      ],
      rows: data.orderItems.map((i) => [
        sqlNumber(i.orderItemId),
        sqlNumber(i.orderId),
        sqlNumber(i.productId),
        sqlNumber(i.quantity),
        sqlNumber(i.unitPrice),
        sqlNumber(i.discount),
      ]),
    },
    payments: {
      columns: ["payment_id", "order_id", "paid_at", "amount", "method", "status"],
      rows: data.payments.map((p) => [
        sqlNumber(p.paymentId),
        sqlNumber(p.orderId),
        sqlTimestamp(p.paidAt),
        sqlNumber(p.amount),
        sqlString(p.method),
        sqlString(p.status),
      ]),
    },
  };
}

function buildSaasTables(): Record<string, TableRows> {
  const data = generateSaasDataset();
  return {
    accounts: {
      columns: ["account_id", "signed_up_at", "region", "segment"],
      rows: data.accounts.map((a) => [
        sqlNumber(a.accountId),
        sqlDate(a.signedUpAt),
        sqlString(a.region),
        sqlString(a.segment),
      ]),
    },
    plans: {
      columns: ["plan_id", "name", "monthly_price", "billing_interval"],
      rows: data.plans.map((p) => [
        sqlNumber(p.planId),
        sqlString(p.name),
        sqlNumber(p.monthlyPrice),
        sqlString(p.billingInterval),
      ]),
    },
    subscriptions: {
      columns: [
        "subscription_id",
        "account_id",
        "plan_id",
        "started_at",
        "ended_at",
        "status",
      ],
      rows: data.subscriptions.map((s) => [
        sqlNumber(s.subscriptionId),
        sqlNumber(s.accountId),
        sqlNumber(s.planId),
        sqlTimestamp(s.startedAt),
        s.endedAt ? sqlTimestamp(s.endedAt) : "NULL",
        sqlString(s.status),
      ]),
    },
    invoices: {
      columns: ["invoice_id", "account_id", "subscription_id", "issued_at", "amount", "status"],
      rows: data.invoices.map((i) => [
        sqlNumber(i.invoiceId),
        sqlNumber(i.accountId),
        sqlNumber(i.subscriptionId),
        sqlTimestamp(i.issuedAt),
        sqlNumber(i.amount),
        sqlString(i.status),
      ]),
    },
    usage_events: {
      columns: ["event_id", "account_id", "event_type", "occurred_at", "quantity"],
      rows: data.usageEvents.map((e) => [
        sqlNumber(e.eventId),
        sqlNumber(e.accountId),
        sqlString(e.eventType),
        sqlTimestamp(e.occurredAt),
        sqlNumber(e.quantity),
      ]),
    },
  };
}

function buildFintechTables(): Record<string, TableRows> {
  const data = generateFintechDataset();
  return {
    customers: {
      columns: ["customer_id", "joined_at", "region", "risk_segment"],
      rows: data.customers.map((c) => [
        sqlNumber(c.customerId),
        sqlDate(c.joinedAt),
        sqlString(c.region),
        sqlString(c.riskSegment),
      ]),
    },
    accounts: {
      columns: ["account_id", "customer_id", "account_type", "opened_at", "status"],
      rows: data.accounts.map((a) => [
        sqlNumber(a.accountId),
        sqlNumber(a.customerId),
        sqlString(a.accountType),
        sqlDate(a.openedAt),
        sqlString(a.status),
      ]),
    },
    transactions: {
      columns: ["transaction_id", "account_id", "occurred_at", "amount", "type", "category"],
      rows: data.transactions.map((t) => [
        sqlNumber(t.transactionId),
        sqlNumber(t.accountId),
        sqlTimestamp(t.occurredAt),
        sqlNumber(t.amount),
        sqlString(t.type),
        sqlString(t.category),
      ]),
    },
    loans: {
      columns: ["loan_id", "customer_id", "originated_at", "principal", "interest_rate", "status"],
      rows: data.loans.map((l) => [
        sqlNumber(l.loanId),
        sqlNumber(l.customerId),
        sqlDate(l.originatedAt),
        sqlNumber(l.principal),
        sqlNumber(l.interestRate),
        sqlString(l.status),
      ]),
    },
    loan_payments: {
      columns: ["payment_id", "loan_id", "paid_at", "amount", "status"],
      rows: data.loanPayments.map((p) => [
        sqlNumber(p.paymentId),
        sqlNumber(p.loanId),
        sqlTimestamp(p.paidAt),
        sqlNumber(p.amount),
        sqlString(p.status),
      ]),
    },
  };
}

const DOMAIN_BUILDERS = {
  ecommerce: buildEcommerceTables,
  saas: buildSaasTables,
  fintech: buildFintechTables,
} as const;

export type DomainSlug = keyof typeof DOMAIN_BUILDERS;

export interface DomainSchemaDescription {
  domain: DomainSlug;
  tables: Array<{
    name: string;
    columns: string[];
    rowCount: number;
    sampleRows: string[][];
  }>;
}

/** Generates one domain's dataset and writes it to `<outDir>/<table>.parquet` plus a `schema.json` description. */
export async function exportDomainDataset(
  domain: DomainSlug,
  outDir: string,
): Promise<DomainSchemaDescription> {
  const tables = DOMAIN_BUILDERS[domain]();
  await mkdir(outDir, { recursive: true });

  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();

  const description: DomainSchemaDescription = { domain, tables: [] };

  try {
    for (const [tableName, table] of Object.entries(tables)) {
      const outFile = path.join(outDir, `${tableName}.parquet`);
      await writeTable(connection, tableName, table, outFile);
      description.tables.push({
        name: tableName,
        columns: table.columns,
        rowCount: table.rows.length,
        sampleRows: table.rows.slice(0, 3),
      });
    }
  } finally {
    connection.closeSync();
    instance.closeSync();
  }

  await writeFile(
    path.join(outDir, "schema.json"),
    JSON.stringify(description, null, 2),
  );

  return description;
}

export async function exportAllDatasets(outRoot: string): Promise<DomainSchemaDescription[]> {
  const domains = Object.keys(DOMAIN_BUILDERS) as DomainSlug[];
  const results: DomainSchemaDescription[] = [];
  for (const domain of domains) {
    results.push(await exportDomainDataset(domain, path.join(outRoot, domain)));
  }
  return results;
}
