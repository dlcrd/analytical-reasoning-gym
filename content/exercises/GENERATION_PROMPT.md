# Exercise generation prompt (paste into a fresh Cowork/Claude session)

Copy everything below the `---` into a new conversation, fill in the `<<...>>` placeholders, and paste the reply straight into a file under `content/exercises/incoming/` (e.g. `batch-1.json`). Then run:

```bash
npm run exercises:admit
```

It validates every exercise (schema shape + actually running the reference SQL against the real dataset) and only admits the ones that pass — anything that fails is reported with the exact reason and never saved. Fix or drop rejected ones, save a new batch, and rerun.

---

You are authoring practice exercises for **Analytical Reasoning Gym**, a tool for practicing the full analytical chain — business problem → metric definition → population/grain → query architecture → SQL → validation — not just SQL syntax. The practitioner is already an analyst, not a beginner: exercises should read like real business questions, never like "write a query using LAG()".

## What to generate

Generate **<<COUNT>> exercises** for:
- **Domain**: `<<DOMAIN>>` (one of `ecommerce`, `saas`, `fintech` — schemas below)
- **Mode**: `<<MODE>>` (one of `metric_lab`, `granularity_trainer`, `query_architecture`, `sql_build` — described below)
- **Level range**: `<<LEVEL_RANGE>>` (integers 3–10; L1/L2 are out of scope, too basic)
- **Skills to emphasize**: `<<SKILLS>>` (from the taxonomy below — pick what fits, don't force all of them into every exercise)

Before writing, check `content/exercises/generation-log.json` in the repo (paste its contents into this conversation if you want me to actually look at it) so you don't repeat a skill+level combination that's already covered for this domain/mode — vary the business scenario and the structure even when the underlying skill repeats.

## Output format — read carefully, this is machine-parsed

Output **only a raw JSON array**, no markdown code fence, no commentary before or after. Each element must match this shape exactly:

```json
{
  "id": "ecommerce-sql_build-l5-refund-rate-by-channel",
  "domain": "ecommerce",
  "mode": "sql_build",
  "level": 5,
  "skills": ["aggregation", "denominator"],
  "title": "Refund rate by channel",
  "prompt": "Leadership wants to know which sales channel has the highest refund rate this year. ...",
  "population": "Orders placed in 2025, across all channels.",
  "grain": "One row per order.",
  "metricDefinition": "refunded orders / total orders, grouped by channel.",
  "transformationPlan": null,
  "referenceSql": "SELECT channel, count(*) FILTER (WHERE status = 'refunded')::DOUBLE / count(*) AS refund_rate FROM orders GROUP BY channel",
  "commonWrongAnswers": [
    { "sql": "SELECT channel, avg(status = 'refunded') FROM orders GROUP BY channel", "whyWrong": "Averaging a boolean works in some engines but is unclear intent and breaks the explicit-denominator habit this exercise is teaching." }
  ]
}
```

Field rules:
- `id`: unique, lowercase, `<domain>-<mode>-l<level>-<short-slug>` (hyphens; underscores allowed only inside `mode`/skill-derived segments).
- `domain` / `mode`: exactly one of the enum values above — no others.
- `level`: integer 3–10, matching the requested range.
- `skills`: 1+ values from the taxonomy below, no duplicates.
- `title`: short, no SQL jargon.
- `prompt`: the business problem, framed the way a stakeholder would actually ask it. Never name the SQL feature needed to solve it.
- `population`, `grain`: required, plain-language, precise enough that a grader could check an answer against them (these back the app's per-step feedback checklist).
- `metricDefinition`: required for `metric_lab` and `query_architecture` exercises that define a metric; `null` when the exercise is purely row-level (e.g. a `sql_build` filtering/joins exercise with no aggregation).
- `transformationPlan`: for `query_architecture` and multi-step `metric_lab` exercises, an ordered array of short steps (e.g. `["aggregate orders to customer×month", "rank customers within month", "filter to top 10"]`); `null` otherwise.
- `referenceSql`: must be valid DuckDB SQL, using **only** the tables/columns listed below — nothing invented. This gets executed for real; if it errors, the exercise is rejected.
- `commonWrongAnswers`: optional, 0+ entries — plausible mistakes and why they're wrong. Omit the field entirely if you have none.

## Skill taxonomy (use only these keys)

`population`, `grain`, `metric_definition`, `denominator`, `filtering`, `aggregation`, `joins`, `dates`, `ctes`, `subqueries`, `conditional_aggregation`, `window_function`, `ranking`, `running_totals`, `rolling_windows`, `lag_lead`, `multi_grain`, `complex_pipelines`, `validation`

## Modes

- **metric_lab**: no SQL upfront. The exercise should be answerable by progressively defining population → event → time window → formula before any query is written. `metricDefinition` is required.
- **granularity_trainer**: about what one row represents at each stage of a pipeline (e.g. order → customer×month → region×month). `grain` should describe at least two distinct stages.
- **query_architecture**: complex, multi-step problems. The practitioner plans raw → aggregate → window → calculate before implementing. `transformationPlan` is required.
- **sql_build**: traditional SQL practice, but always framed as a business problem (filtering, aggregation, joins, dates, CTEs, subqueries, conditional aggregation, window functions, ranking, running totals, rolling windows, LAG/LEAD, multi-grain, complex pipelines).

## Domain schemas

### ecommerce

| table | columns |
|---|---|
| `customers` | `customer_id` INTEGER pk, `signup_date` DATE, `region` VARCHAR (`north`/`south`/`midwest`/`west`), `segment` VARCHAR (`retail`/`wholesale`) |
| `products` | `product_id` INTEGER pk, `category` VARCHAR (`electronics`/`home`/`apparel`/`beauty`/`sports`), `price` DOUBLE, `cost` DOUBLE |
| `orders` | `order_id` INTEGER pk, `customer_id` INTEGER fk→customers, `order_date` DATE, `status` VARCHAR (`completed`/`cancelled`/`refunded`), `channel` VARCHAR (`web`/`app`/`marketplace`) |
| `order_items` | `order_item_id` INTEGER pk, `order_id` INTEGER fk→orders, `product_id` INTEGER fk→products, `quantity` INTEGER, `unit_price` DOUBLE, `discount` DOUBLE (0, 0.1, or 0.2) |
| `payments` | `payment_id` INTEGER pk, `order_id` INTEGER fk→orders (one payment per order), `paid_at` TIMESTAMP, `amount` DOUBLE, `method` VARCHAR (`card`/`paypal`/`bank_transfer`), `status` VARCHAR (`succeeded`/`failed`/`refunded`) |

Row counts: customers 300, products 60, orders 1500, order_items ~4600, payments 1500.

### saas

| table | columns |
|---|---|
| `accounts` | `account_id` INTEGER pk, `signed_up_at` DATE, `region` VARCHAR, `segment` VARCHAR (`smb`/`mid_market`/`enterprise`) |
| `plans` | `plan_id` INTEGER pk, `name` VARCHAR, `monthly_price` DOUBLE, `billing_interval` VARCHAR (`monthly`/`annual`) |
| `subscriptions` | `subscription_id` INTEGER pk, `account_id` INTEGER fk→accounts, `plan_id` INTEGER fk→plans, `started_at` TIMESTAMP, `ended_at` TIMESTAMP nullable (NULL = still active), `status` VARCHAR (`trial`/`active`/`canceled`) |
| `invoices` | `invoice_id` INTEGER pk, `account_id` INTEGER fk, `subscription_id` INTEGER fk, `issued_at` TIMESTAMP, `amount` DOUBLE, `status` VARCHAR (`paid`/`failed`/`pending`) |
| `usage_events` | `event_id` INTEGER pk, `account_id` INTEGER fk, `event_type` VARCHAR (`login`/`feature_used`/`api_call`/`report_exported`), `occurred_at` TIMESTAMP, `quantity` INTEGER |

Row counts: accounts 200, plans 5, subscriptions ~270 (some accounts have 2, from an upgrade), invoices ~1200, usage_events ~6400.

### fintech

| table | columns |
|---|---|
| `customers` | `customer_id` INTEGER pk, `joined_at` DATE, `region` VARCHAR, `risk_segment` VARCHAR (`low`/`medium`/`high`) |
| `accounts` | `account_id` INTEGER pk, `customer_id` INTEGER fk→customers (a customer can have 1-3 accounts), `account_type` VARCHAR (`checking`/`savings`/`credit`), `opened_at` DATE, `status` VARCHAR (`active`/`closed`) |
| `transactions` | `transaction_id` INTEGER pk, `account_id` INTEGER fk→accounts, `occurred_at` TIMESTAMP, `amount` DOUBLE, `type` VARCHAR (`debit`/`credit`), `category` VARCHAR (`groceries`/`rent`/`utilities`/`entertainment`/`transfer`/`salary`) |
| `loans` | `loan_id` INTEGER pk, `customer_id` INTEGER fk→customers, `originated_at` DATE, `principal` DOUBLE, `interest_rate` DOUBLE, `status` VARCHAR (`current`/`paid_off`/`default`) |
| `loan_payments` | `payment_id` INTEGER pk, `loan_id` INTEGER fk→loans, `paid_at` TIMESTAMP, `amount` DOUBLE, `status` VARCHAR (`on_time`/`late`/`missed`) |

Row counts: customers 250, accounts ~380, transactions ~12,000, loans ~90, loan_payments ~1300.

Note: only ~40% of customers have a loan — don't write exercises that assume every customer does.
