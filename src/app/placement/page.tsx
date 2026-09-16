"use client";

import { useEffect, useState } from "react";
import { BudgetQuestion } from "@/components/placement/BudgetQuestion";
import { MultipleChoiceQuestion } from "@/components/placement/MultipleChoiceQuestion";
import { OrderingQuestion } from "@/components/placement/OrderingQuestion";
import { SchemaPanel } from "@/components/SchemaPanel";
import { SqlEditor } from "@/components/SqlEditor";
import type { Domain, Mode } from "@/db/schema";
import type { QueryResult } from "@/lib/grading";

interface Option {
  id: string;
  label: string;
}

interface QuestionBase {
  id: string;
  mode: Mode;
  domain: Domain;
  level: number;
  title: string;
  prompt: string;
}

type PlacementQuestion =
  | (QuestionBase & {
      questionType: "sql";
      population: string;
      grain: string;
      metricDefinition: string | null;
      transformationPlan: string[] | null;
      expectedColumns: string[] | null;
    })
  | (QuestionBase & { questionType: "multiple_choice"; explanation: string; options: Option[] })
  | (QuestionBase & { questionType: "ordering"; explanation: string; steps: Option[] })
  | (QuestionBase & {
      questionType: "budget";
      explanation: string;
      budgetAmount: number;
      investigations: Array<{ id: string; label: string; cost: number; revealText: string }>;
      recommendationOptions: Option[];
    });

interface Grade {
  matches: boolean;
  reason?: string;
}

const MODE_LABELS: Record<Mode, string> = {
  metric_lab: "Metric Lab",
  granularity_trainer: "Granularity Trainer",
  query_architecture: "Query Architecture",
  sql_build: "SQL Build",
};

const PRIMARY_BUTTON =
  "w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const SECONDARY_BUTTON =
  "rounded-full border border-zinc-300 px-5 py-2 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800";
const CARD = "rounded border border-zinc-200 dark:border-zinc-700";

type Phase = "loading" | "intro" | "concept" | "answer" | "graded" | "finished";

export default function PlacementPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [sql, setSql] = useState("");
  const [runResult, setRunResult] = useState<QueryResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [lastGrade, setLastGrade] = useState<Grade | null>(null);
  const [levelsByMode, setLevelsByMode] = useState<Record<Mode, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = questions[index];

  useEffect(() => {
    checkForActiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function phaseFor(question: PlacementQuestion): Phase {
    return question.questionType === "sql" ? "concept" : "answer";
  }

  async function checkForActiveSession() {
    setError(null);
    try {
      const response = await fetch("/api/placement/active");
      if (!response.ok) throw new Error("Falha ao verificar sessão de nivelamento em andamento.");
      const active = (await response.json()) as {
        sessionId: string;
        questions: PlacementQuestion[];
        answeredExerciseIds: string[];
      } | null;

      if (!active) {
        setPhase("intro");
        return;
      }

      const answered = new Set(active.answeredExerciseIds);
      const nextIndex = active.questions.findIndex((question) => !answered.has(question.id));

      setSessionId(active.sessionId);
      setQuestions(active.questions);

      if (nextIndex === -1) {
        // Every question was answered but the session was never finalized (e.g. closed mid-way).
        await finishTest(active.sessionId);
        return;
      }

      setIndex(nextIndex);
      setPhase(phaseFor(active.questions[nextIndex]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("intro");
    }
  }

  async function startTest() {
    setError(null);
    try {
      const response = await fetch("/api/placement/start", { method: "POST" });
      if (!response.ok) throw new Error("Falha ao iniciar o teste de nivelamento.");
      const data = (await response.json()) as { sessionId: string; exercises: PlacementQuestion[] };
      setSessionId(data.sessionId);
      setQuestions(data.exercises);
      setIndex(0);
      setPhase(phaseFor(data.exercises[0]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function goToAnswer() {
    resetAnswerState();
    setPhase("answer");
  }

  function resetAnswerState() {
    setSql("");
    setRunResult(null);
    setRunError(null);
    setLastGrade(null);
  }

  async function runSqlAgainstDataset() {
    if (!currentQuestion || currentQuestion.questionType !== "sql") return;
    setRunError(null);
    setRunResult(null);
    try {
      const { runSql } = await import("@/lib/duckdb-runner");
      const result = await runSql(currentQuestion.domain, sql);
      setRunResult(result);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }

  async function recordAttempt(exerciseId: string, isCorrect: boolean, feedbackChecklist: unknown) {
    if (!sessionId) return;
    await fetch("/api/placement/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, exerciseId, isCorrect, feedbackChecklist }),
    });
  }

  async function gradeAndRecord(exerciseId: string, answerBody: unknown, feedbackChecklist: unknown) {
    setGrading(true);
    setError(null);
    try {
      const response = await fetch(`/api/exercises/${exerciseId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answerBody),
      });
      if (!response.ok) throw new Error("Falha ao avaliar a resposta.");
      const grade = (await response.json()) as Grade;
      await recordAttempt(exerciseId, grade.matches, feedbackChecklist);
      setLastGrade(grade);
      setPhase("graded");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGrading(false);
    }
  }

  async function submitSqlAnswer() {
    if (!currentQuestion || currentQuestion.questionType !== "sql") return;

    if (!runResult) {
      const reason = runError ?? "SQL não executado ou com erro.";
      await recordAttempt(currentQuestion.id, false, { sqlSyntax: false, result: false, reason });
      setLastGrade({ matches: false, reason });
      setPhase("graded");
      return;
    }

    await gradeAndRecord(currentQuestion.id, { type: "sql", ...runResult }, { sqlSyntax: true });
  }

  async function submitMultipleChoice(selectedOptionId: string) {
    if (!currentQuestion) return;
    await gradeAndRecord(
      currentQuestion.id,
      { type: "multiple_choice", selectedOptionId },
      { selectedOptionId },
    );
  }

  async function submitOrdering(submittedOrder: string[]) {
    if (!currentQuestion) return;
    await gradeAndRecord(currentQuestion.id, { type: "ordering", submittedOrder }, { submittedOrder });
  }

  async function submitBudget(answer: { selectedInvestigationIds: string[]; recommendationOptionId: string }) {
    if (!currentQuestion) return;
    await gradeAndRecord(currentQuestion.id, { type: "budget", ...answer }, answer);
  }

  async function nextQuestion() {
    const isLast = index === questions.length - 1;
    if (!isLast) {
      const next = questions[index + 1];
      setIndex((prev) => prev + 1);
      resetAnswerState();
      setPhase(phaseFor(next));
      return;
    }

    await finishTest();
  }

  async function finishTest(overrideSessionId?: string) {
    const activeSessionId = overrideSessionId ?? sessionId;
    if (!activeSessionId) return;
    setError(null);
    try {
      const response = await fetch("/api/placement/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId }),
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
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Teste de Nivelamento</h1>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {phase === "loading" && <p className="text-zinc-500 dark:text-zinc-400">Carregando...</p>}

      {phase === "intro" && (
        <div className="flex flex-col gap-4">
          <p className="text-zinc-600 dark:text-zinc-300">
            16 perguntas (SQL e formatos fechados — múltipla escolha, ordenamento, orçamento) para
            definir seu nível inicial em cada um dos 4 modos. Sem dicas — cada acerto conta como sem
            ajuda. Cada resposta é salva na hora, então dá pra fechar e continuar depois de onde parou.
          </p>
          <button onClick={startTest} className={PRIMARY_BUTTON}>
            Começar
          </button>
        </div>
      )}

      {currentQuestion && phase !== "loading" && phase !== "intro" && phase !== "finished" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pergunta {index + 1} de {questions.length} — {MODE_LABELS[currentQuestion.mode]} · L
          {currentQuestion.level} · {currentQuestion.domain}
        </p>
      )}

      {phase === "concept" && currentQuestion && currentQuestion.questionType === "sql" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{currentQuestion.title}</h2>
          <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{currentQuestion.prompt}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Antes de escrever SQL, pense: qual é a população, a grain e a definição da métrica desta
            pergunta? Não há campo pra digitar isso — é só pra você organizar o raciocínio antes de
            codar.
          </p>
          <button onClick={goToAnswer} className={PRIMARY_BUTTON}>
            Continuar para SQL
          </button>
        </div>
      )}

      {phase === "answer" && currentQuestion && currentQuestion.questionType === "sql" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{currentQuestion.title}</h2>
          <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{currentQuestion.prompt}</p>
          <SchemaPanel domain={currentQuestion.domain} />
          {currentQuestion.expectedColumns && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Formato de saída esperado: colunas{" "}
              {currentQuestion.expectedColumns.map((col, i) => (
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
            <button onClick={submitSqlAnswer} disabled={grading} className={PRIMARY_BUTTON}>
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

      {phase === "answer" && currentQuestion && currentQuestion.questionType !== "sql" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{currentQuestion.title}</h2>
          <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{currentQuestion.prompt}</p>

          {currentQuestion.questionType === "multiple_choice" && (
            <MultipleChoiceQuestion
              options={currentQuestion.options}
              onSubmit={submitMultipleChoice}
              submitting={grading}
            />
          )}
          {currentQuestion.questionType === "ordering" && (
            <OrderingQuestion steps={currentQuestion.steps} onSubmit={submitOrdering} submitting={grading} />
          )}
          {currentQuestion.questionType === "budget" && (
            <BudgetQuestion
              budgetAmount={currentQuestion.budgetAmount}
              investigations={currentQuestion.investigations}
              recommendationOptions={currentQuestion.recommendationOptions}
              onSubmit={submitBudget}
              submitting={grading}
            />
          )}
        </div>
      )}

      {phase === "graded" && currentQuestion && lastGrade && (
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

          {!lastGrade.matches && currentQuestion.questionType === "sql" && (
            <div className={`flex flex-col gap-2 p-4 text-sm text-zinc-800 dark:text-zinc-100 ${CARD}`}>
              <p>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Population: </span>
                {currentQuestion.population}
              </p>
              <p>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Grain: </span>
                {currentQuestion.grain}
              </p>
              {currentQuestion.metricDefinition && (
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">Metric Definition: </span>
                  {currentQuestion.metricDefinition}
                </p>
              )}
              {currentQuestion.transformationPlan && (
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">Transformation Plan:</span>
                  <ol className="ml-5 list-decimal">
                    {currentQuestion.transformationPlan.map((step, i) => (
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

          {!lastGrade.matches && currentQuestion.questionType !== "sql" && (
            <div className={`flex flex-col gap-2 p-4 text-sm text-zinc-800 dark:text-zinc-100 ${CARD}`}>
              <p>{currentQuestion.explanation}</p>
            </div>
          )}

          <button onClick={nextQuestion} className={PRIMARY_BUTTON}>
            {index === questions.length - 1 ? "Finalizar teste" : "Próxima pergunta"}
          </button>
        </div>
      )}

      {phase === "finished" && levelsByMode && (
        <div className="flex flex-col gap-4">
          <p className="text-zinc-700 dark:text-zinc-200">Nível inicial definido em cada modo:</p>
          <ul className="flex flex-col gap-2">
            {(Object.keys(MODE_LABELS) as Mode[]).map((mode) => (
              <li
                key={mode}
                className={`flex items-center justify-between px-4 py-2 text-zinc-900 dark:text-zinc-50 ${CARD}`}
              >
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
