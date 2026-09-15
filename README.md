# Analytical Reasoning Gym

Personal tool for practicing the full analytical reasoning chain — business problem → metric definition → population/grain → query architecture → SQL → validation. Single user, no accounts. See `claude/v1-escopo-decisoes.md` for the locked V1 scope and `CONTEXT.md` for domain terminology.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Postgres (operational data: exercise index, progress, sessions) via [Drizzle ORM](https://orm.drizzle.team/), hosted on Vercel Postgres/Neon
- Exercise datasets run client-side in DuckDB-WASM (separate from the operational Postgres DB — see `CONTEXT.md`'s "Dataset" entry)
- Vitest for tests, ESLint for linting

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

Schema lives in `src/db/schema.ts`; migrations are generated with `drizzle-kit` into `src/db/migrations/`.

```bash
npm run db:generate   # generate a migration after changing src/db/schema.ts
npm run db:migrate    # apply pending migrations (requires DATABASE_URL)
```

Set `DATABASE_URL` (a Postgres connection string) in `.env.local` before running `db:migrate` against a real database. Schema contract tests (`src/db/__tests__/`) don't need it — they run migrations against an in-memory Postgres (`@electric-sql/pglite`).

## Exercise content

Synthetic datasets (one per domain — e-commerce, SaaS, fintech) live under `public/datasets/` (static assets the browser's DuckDB-WASM fetches directly); authored exercises live under `content/exercises/`. Both are generated/validated by scripts in `scripts/`:

```bash
npm run datasets:generate  # (re)generate the 3 domain datasets as Parquet, into public/datasets/
npm run exercises:admit    # validate batches in content/exercises/incoming/, admit the passing ones
```

To author new exercises: paste `content/exercises/GENERATION_PROMPT.md` into a Cowork/Claude session (it embeds the current dataset schemas and the output format), save the JSON reply as a file under `content/exercises/incoming/`, then run `exercises:admit`. Only exercises whose reference SQL actually runs against the real dataset get admitted into `content/exercises/validated/`; everything else is reported and discarded. `content/exercises/generation-log.json` tracks what's already been admitted, to avoid repeating the same skill/level combos.

## Deploy

Deployed to Vercel. Two env vars must be set in the Vercel project (see `.env.example`):

- `DATABASE_URL` — the Postgres connection string (Vercel Postgres/Neon).
- `SITE_PASSWORD` — the shared password gating the whole app (single-user tool, no accounts). When this is set, `middleware.ts` redirects every request without a valid session cookie to `/login`; `/api/auth/login` checks the submitted password against it and sets the session cookie on success. Leaving it unset (e.g. local dev) leaves the app open.

```bash
vercel link      # first time only, links this directory to a Vercel project
vercel env pull  # pull DATABASE_URL / SITE_PASSWORD into .env.local for local dev
vercel deploy --prod
```

## Testing and linting

```bash
npm test              # run all tests once
npm run test:coverage # with coverage
npm run lint
```
