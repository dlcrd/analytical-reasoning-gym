"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { modeValues, type Mode } from "@/db/schema";

interface SkillStat {
  key: string;
  label: string;
  correct: number;
  total: number;
  accuracy: number;
}

interface Dashboard {
  streakDays: number;
  skills: SkillStat[];
  levelsByMode: Partial<Record<Mode, number>>;
}

const MODE_LABELS: Record<Mode, string> = {
  metric_lab: "Metric Lab",
  granularity_trainer: "Granularity Trainer",
  query_architecture: "Query Architecture",
  sql_build: "SQL Build",
};

const CARD = "rounded border border-zinc-200 dark:border-zinc-700";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => {
        if (!response.ok) throw new Error("Falha ao carregar o dashboard.");
        return response.json() as Promise<Dashboard>;
      })
      .then(setDashboard)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const weakestFirst = dashboard ? [...dashboard.skills].sort((a, b) => a.accuracy - b.accuracy) : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          Voltar
        </Link>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!dashboard && !error && <p className="text-zinc-500 dark:text-zinc-400">Carregando...</p>}

      {dashboard && (
        <>
          <div className={`flex items-center gap-3 px-4 py-3 ${CARD}`}>
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                {dashboard.streakDays} {dashboard.streakDays === 1 ? "dia" : "dias"} seguidos
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Streak de prática</p>
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nível por modo</h2>
            <div className="flex flex-wrap gap-3">
              {modeValues.map((mode) => (
                <Link
                  key={mode}
                  href={`/practice/${mode}`}
                  className={`flex items-center justify-between gap-4 px-4 py-2 text-zinc-900 hover:bg-zinc-50 dark:text-zinc-50 dark:hover:bg-zinc-800 ${CARD}`}
                >
                  <span>{MODE_LABELS[mode]}</span>
                  <span className="font-medium">L{dashboard.levelsByMode[mode] ?? "—"}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Skills (mais fracas primeiro)
            </h2>
            {weakestFirst.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhuma tentativa registrada ainda — pratique um dos modos pra começar a ver seu
                progresso aqui.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {weakestFirst.map((skill) => (
                  <div key={skill.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm text-zinc-800 dark:text-zinc-100">
                      <span>{skill.label}</span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {Math.round(skill.accuracy * 100)}% ({skill.correct}/{skill.total})
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                        style={{ width: `${Math.round(skill.accuracy * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
