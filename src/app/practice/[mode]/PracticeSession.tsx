"use client";

import { useEffect, useState } from "react";
import { SchemaPanel } from "@/components/SchemaPanel";
import { SqlEditor } from "@/components/SqlEditor";
import type { Domain, Mode } from "@/db/schema";
import type { QueryResult } from "@/lib/grading";

interface ExercisePreview {
  id: string;
  mode: Mode;
  domain: Domain;
  level: number;
  title: string;
  prompt: string;
  population: string;
  grain: string;
  metricDefinition: string | null;
  transformationPlan: string[] | null;
  expectedColumns: string[] | null;
}

const MODE_LABELS: Record<Mode, string> = {
  metric_lab: "Metric Lab",
  granularity_trainer: "Granularity Trainer",
  query_architecture: "Query Architecture",
  sql_build: "SQL Build",
};

/** What each Mode's concept phase asks the student to nail down before writing SQL. */
const MODE_CONCEPT_PROMPT: Record<Mode, string> = {
  metric_lab:
    "Antes de escrever SQL, defina a métrica com precisão: o que exatamente ela mede, qual o numerador e o denominador (se houver). Não há campo pra digitar isso — é só pra organizar o raciocínio antes de codar.",
  granularity_trainer:
    "Antes de escrever SQL, defina a grain: o que representa uma linha do resultado? Qual a população e em que nível ela deve ser agregada. Não há campo pra digitar isso — é só pra organizar o raciocínio antes de codar.",
  query_architecture:
    "Antes de escrever SQL, planeje o pipeline: quais etapas de transformação (filtrar, agregar, juntar, empilhar) e em que ordem. Não há campo pra digitar isso — é só pra organizar o raciocínio antes de codar.",
  sql_build:
    "Antes de escrever SQL, pense: qual é a população, a grain e a definição da métrica desta pergunta? Não há campo pra digitar isso — é só pra organizar o raciocínio antes de codar.",
};

const PRIMARY_BUTTON =
  "w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const SECONDARY_BUTTON =
  "rounded-full border border-zinc-300 px-5 py-2 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800";
const CARD = "rounded border border-zinc-200 dark:border-zinc-700";

type Phase = "loading" | "concept" | "sql" | "graded" | "empty";

export function PracticeSession({ mode }: { mode: Mode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exercise, setExercise] = useState<ExercisePreview | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [levelStreak, setLevelStreak] = useState(0);
  const [sql, setSql] = useState("");
  const [runResult, setRunResult] = useState<QueryResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [lastGrade, setLastGrade] = useState<{ matches: boolean; reason?: string } | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);
  const [pendingNext, setPendingNext] = useState<ExercisePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function startSession() {
    setPhase("loading");
    setError(null);
    try {
      const response = await fetch(`/api/practice/${mode}/start`, { method: "POST" });
      if (!response.ok) throw new Error("Falha ao iniciar a sessão de prática.");
      const data = (await response.json()) as {
        sessionId: string;
        currentLevel: number;
        levelStreak: number;
        exercise: ExercisePreview | null;
      };
      setSessionId(data.sessionId);
      setCurrentLevel(data.currentLevel);
      setLevelStreak(data.levelStreak);
      setExercise(data.exercise);
      setPhase(data.exercise ? "concept" : "empty");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function goToSql() {
    setSql("");
    setRunResult(null);
    setRunError(null);
    setLastGrade(null);
    setPhase("sql");
  }

  async function runSqlAgainstDataset() {
    if (!exercise) return;
    setRunError(null);
    setRunResult(null);
    try {
      const { runSql } = await import("@/lib/duckdb-runner");
      const result = await runSql(exercise.domain, sql);
      setRunResult(result);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submitAnswer() {
    if (!exercise || !sessionId) return;

    let isCorrect = false;
    let reason: string | undefined;
    if (!runResult) {
      reason = runError ?? "SQL não executado ou com erro.";
    } else {
      setGrading(true);
      try {
        const response = await fetch(`/api/exercises/${exercise.id}/grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "sql", ...runResult }),
        });
        if (!response.ok) throw new Error("Falha ao avaliar a resposta.");
        const grade = (await response.json()) as { matches: boolean; reason?: string };
        isCorrect = grade.matches;
        reason = grade.reason;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setGrading(false);
        return;
      }
    }

    setError(null);
    try {
      const response = await fetch(`/api/practice/${mode}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          exerciseId: exercise.id,
          isCorrect,
          feedbackChecklist: { sqlSyntax: Boolean(runResult), result: isCorrect, reason },
        }),
      });
      if (!response.ok) throw new Error("Falha ao registrar a tentativa.");
      const data = (await response.json()) as {
        currentLevel: number;
        levelStreak: number;
        leveledUp: boolean;
        nextExercise: ExercisePreview | null;
      };
      setCurrentLevel(data.currentLevel);
      setLevelStreak(data.levelStreak);
      setLeveledUp(data.leveledUp);
      setLastGrade({ matches: isCorrect, reason });
      // Keep `exercise` as-is for the graded-phase self-assessment reveal; swap in nextExercise on "Próximo".
      setPendingNext(data.nextExercise);
      setPhase("graded");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGrading(false);
    }
  }

  function nextExercise() {
    if (pendingNext) {
      setExercise(pendingNext);
      setPendingNext(null);
      setPhase("concept");
    } else {
      startSession();
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{MODE_LABELS[mode]}</h1>
        {currentLevel !== null && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            L{currentLevel} · streak {levelStreak}/2
          </span>
        )}
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {phase === "loading" && <p className="text-zinc-500 dark:text-zinc-400">Carregando exercício...</p>}

      {phase === "empty" && (
        <p className="text-zinc-500 dark:text-zinc-400">
          Nenhum exercício admitido ainda para {MODE_LABELS[mode]} no nível L{currentLevel}.
        </p>
      )}

      {phase === "concept" && exercise && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{exercise.title}</h2>
          <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{exercise.prompt}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{MODE_CONCEPT_PROMPT[mode]}</p>
          <button onClick={goToSql} className={PRIMARY_BUTTON}>
            Continuar para SQL
          </button>
        </div>
      )}

      {phase === "sql" && exercise && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{exercise.title}</h2>
          <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{exercise.prompt}</p>
          <SchemaPanel domain={exercise.domain} />
          {exercise.expectedColumns && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Formato de saída esperado: colunas{" "}
              {exercise.expectedColumns.map((col, i) => (
                <span key={col}>
                  {i > 0 && ", "}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">{col}</code>
                </span>
              ))}{" "}
              (nomes flexíveis, mas essa é a forma esperada).
            </p>
          )}
          <SqlEditor value={sql} onChange={setSql} placeholder={`SELECT ...\nFROM ...`} />
          <div className="flex gap-3">
            <button onClick={runSqlAgainstDataset} className={SECONDARY_BUTTON}>
              Rodar
            </button>
            <button onClick={submitAnswer} disabled={grading} className={PRIMARY_BUTTON}>
              {grading ? "Avaliando..." : "Enviar resposta"}
            </button>
          </div>

          {runError && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {runError}
            </p>
          )}

          {runResult && (
            <div className={`overflow-x-auto ${CARD}`}>
              <table className="w-full text-sm text-zinc-900 dark:text-zinc-100">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800">
                    {runResult.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runResult.rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {phase === "graded" && exercise && lastGrade && (
        <div className="flex flex-col gap-4">
          <p
            className={`rounded px-3 py-2 text-sm ${
              lastGrade.matches
                ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {lastGrade.matches ? "Resultado correto." : `Resultado incorreto. ${lastGrade.reason ?? ""}`}
          </p>

          {leveledUp && (
            <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              2 acertos seguidos — nível avançou para L{currentLevel}.
            </p>
          )}

          {!lastGrade.matches && (
            <div className={`flex flex-col gap-2 p-4 text-sm text-zinc-800 dark:text-zinc-100 ${CARD}`}>
              <p>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Population: </span>
                {exercise.population}
              </p>
              <p>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Grain: </span>
                {exercise.grain}
              </p>
              {exercise.metricDefinition && (
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">Metric Definition: </span>
                  {exercise.metricDefinition}
                </p>
              )}
              {exercise.transformationPlan && (
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">Transformation Plan:</span>
                  <ol className="ml-5 list-decimal">
                    {exercise.transformationPlan.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="text-zinc-500 dark:text-zinc-400">
                Compare com o que você pensou antes de codar e identifique qual conceito faltou.
              </p>
            </div>
          )}

          <button onClick={nextExercise} className={PRIMARY_BUTTON}>
            Próximo exercício
          </button>
        </div>
      )}
    </div>
  );
}
