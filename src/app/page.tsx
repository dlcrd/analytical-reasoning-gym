import Link from "next/link";
import { modeValues } from "@/db/schema";

const MODE_LABELS: Record<(typeof modeValues)[number], string> = {
  metric_lab: "Metric Lab",
  granularity_trainer: "Granularity Trainer",
  query_architecture: "Query Architecture",
  sql_build: "SQL Build",
};

export default function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Analytical Reasoning Gym</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        Treino de raciocínio analítico: população, grain, definição de métrica e arquitetura de
        query — não só sintaxe SQL.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/placement"
          className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Fazer o Teste de Nivelamento
        </Link>
        <Link
          href="/dashboard"
          className="w-fit rounded-full border border-zinc-300 px-5 py-2.5 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Ver Dashboard
        </Link>
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Modos de prática</h2>
        <div className="flex flex-wrap gap-3">
          {modeValues.map((mode) => (
            <Link
              key={mode}
              href={`/practice/${mode}`}
              className="rounded-full border border-zinc-300 px-5 py-2 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {MODE_LABELS[mode]}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
