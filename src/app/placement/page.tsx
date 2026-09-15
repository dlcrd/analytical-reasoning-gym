"use client";

import { useState } from "react";
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
}

interface AttemptRecord {
  exerciseId: string;
  isCorrect: boolean;
  feedbackChecklist: {
    sqlSyntax: boolean;
    result: boolean;
    reason?: string;
  };
}

const MODE_LABELS: Record<Mode, string> = {
  metric_lab: "Metric Lab",
  granularity_trainer: "Granularity Trainer",
  query_architecture: "Query Architecture",
  sql_build: "SQL Build",
};

type Phase = "intro" | "concept" | "sql" | "graded" | "finished";

export default function PlacementPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExercisePreview[]>([]);
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [sql, setSql] = useState("");
  const [runResult, setRunResult] = useState<QueryResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [lastGrade, setLastGrade] = useState<{ matches: boolean; reason?: string } | null>(null);
  const [levelsByMode, setLevelsByMode] = useState<Record<Mode, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentExercise = exercises[index];

  async function startTest() {
    setError(null);
    try {
      const response = await fetch("/api/placement/start", { method: "POST" });
      if (!response.ok) throw new Error("Falha ao iniciar o teste de nivelamento.");
      const data = (await response.json()) as { sessionId: string; exercises: ExercisePreview[] };
      setSessionId(data.sessionId);
      setExercises(data.exercises);
      setIndex(0);
      setAttempts([]);
      setPhase("concept");
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
    if (!currentExercise) return;
    setRunError(null);
    setRunResult(null);
    try {
      const { runSql } = await import("@/lib/duckdb-runner");
      const result = await runSql(currentExercise.domain, sql);
      setRunResult(result);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submitAnswer() {
    if (!currentExercise) return;

    if (!runResult) {
      const record: AttemptRecord = {
        exerciseId: currentExercise.id,
        isCorrect: false,
        feedbackChecklist: {
          sqlSyntax: false,
          result: false,
          reason: runError ?? "SQL não executado ou com erro.",
        },
      };
      setAttempts((prev) => [...prev, record]);
      setLastGrade({ matches: false, reason: record.feedbackChecklist.reason });
      setPhase("graded");
      return;
    }

    setGrading(true);
    setError(null);
    try {
      const response = await fetch(`/api/exercises/${currentExercise.id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runResult),
      });
      if (!response.ok) throw new Error("Falha ao avaliar a resposta.");
      const grade = (await response.json()) as { matches: boolean; reason?: string };

      const record: AttemptRecord = {
        exerciseId: currentExercise.id,
        isCorrect: grade.matches,
        feedbackChecklist: { sqlSyntax: true, result: grade.matches, reason: grade.reason },
      };
      setAttempts((prev) => [...prev, record]);
      setLastGrade(grade);
      setPhase("graded");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGrading(false);
    }
  }

  async function nextExercise() {
    const isLast = index === exercises.length - 1;
    if (!isLast) {
      setIndex((prev) => prev + 1);
      setPhase("concept");
      return;
    }

    if (!sessionId) return;
    setError(null);
    try {
      const response = await fetch("/api/placement/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, attempts }),
      });
      if (!response.ok) throw new Error("Falha ao finalizar o teste de nivelamento.");
      const data = (await response.json()) as { levelsByMode: Record<Mode, number> };
      setLevelsByMode(data.levelsByMode);
      setPhase("finished");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Teste de Nivelamento</h1>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {phase === "intro" && (
        <div className="flex flex-col gap-4">
          <p className="text-zinc-600">
            16 exercícios (2 por modo em L4, 2 por modo em L5) para definir seu nível inicial em cada um
            dos 4 modos. Sem dicas — cada acerto conta como sem ajuda.
          </p>
          <button
            onClick={startTest}
            className="w-fit rounded-full bg-black px-5 py-2.5 text-white hover:bg-zinc-800"
          >
            Começar
          </button>
        </div>
      )}

      {currentExercise && phase !== "intro" && phase !== "finished" && (
        <p className="text-sm text-zinc-500">
          Exercício {index + 1} de {exercises.length} — {MODE_LABELS[currentExercise.mode]} · L
          {currentExercise.level} · {currentExercise.domain}
        </p>
      )}

      {phase === "concept" && currentExercise && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{currentExercise.title}</h2>
          <p className="whitespace-pre-wrap text-zinc-800">{currentExercise.prompt}</p>
          <p className="text-sm text-zinc-500">
            Antes de escrever SQL, pense: qual é a população, a grain e a definição da métrica desta
            pergunta? Não há campo pra digitar isso — é só pra você organizar o raciocínio antes de
            codar.
          </p>
          <button
            onClick={goToSql}
            className="w-fit rounded-full bg-black px-5 py-2.5 text-white hover:bg-zinc-800"
          >
            Continuar para SQL
          </button>
        </div>
      )}

      {phase === "sql" && currentExercise && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{currentExercise.title}</h2>
          <p className="whitespace-pre-wrap text-zinc-800">{currentExercise.prompt}</p>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full rounded border border-zinc-300 p-3 font-mono text-sm"
            placeholder={`SELECT ...\nFROM ...`}
          />
          <div className="flex gap-3">
            <button
              onClick={runSqlAgainstDataset}
              className="rounded-full border border-zinc-300 px-5 py-2 hover:bg-zinc-50"
            >
              Rodar
            </button>
            <button
              onClick={submitAnswer}
              disabled={grading}
              className="rounded-full bg-black px-5 py-2 text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {grading ? "Avaliando..." : "Enviar resposta"}
            </button>
          </div>

          {runError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{runError}</p>}

          {runResult && (
            <div className="overflow-x-auto rounded border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50">
                    {runResult.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runResult.rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t border-zinc-100">
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

      {phase === "graded" && currentExercise && lastGrade && (
        <div className="flex flex-col gap-4">
          <p
            className={`rounded px-3 py-2 text-sm ${
              lastGrade.matches ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            {lastGrade.matches ? "Resultado correto." : `Resultado incorreto. ${lastGrade.reason ?? ""}`}
          </p>

          {!lastGrade.matches && (
            <div className="flex flex-col gap-2 rounded border border-zinc-200 p-4 text-sm">
              <p>
                <span className="font-medium">Population: </span>
                {currentExercise.population}
              </p>
              <p>
                <span className="font-medium">Grain: </span>
                {currentExercise.grain}
              </p>
              {currentExercise.metricDefinition && (
                <p>
                  <span className="font-medium">Metric Definition: </span>
                  {currentExercise.metricDefinition}
                </p>
              )}
              {currentExercise.transformationPlan && (
                <div>
                  <span className="font-medium">Transformation Plan:</span>
                  <ol className="ml-5 list-decimal">
                    {currentExercise.transformationPlan.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="text-zinc-500">
                Compare com o que você pensou antes de codar e identifique qual conceito faltou.
              </p>
            </div>
          )}

          <button
            onClick={nextExercise}
            className="w-fit rounded-full bg-black px-5 py-2.5 text-white hover:bg-zinc-800"
          >
            {index === exercises.length - 1 ? "Finalizar teste" : "Próximo exercício"}
          </button>
        </div>
      )}

      {phase === "finished" && levelsByMode && (
        <div className="flex flex-col gap-4">
          <p className="text-zinc-700">Nível inicial definido em cada modo:</p>
          <ul className="flex flex-col gap-2">
            {(Object.keys(MODE_LABELS) as Mode[]).map((mode) => (
              <li key={mode} className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2">
                <span>{MODE_LABELS[mode]}</span>
                <span className="font-medium">L{levelsByMode[mode]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
