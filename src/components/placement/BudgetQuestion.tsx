"use client";

import { useState } from "react";

interface Investigation {
  id: string;
  label: string;
  cost: number;
  revealText: string;
}

interface Option {
  id: string;
  label: string;
}

interface BudgetAnswer {
  selectedInvestigationIds: string[];
  recommendationOptionId: string;
}

interface BudgetQuestionProps {
  budgetAmount: number;
  investigations: Investigation[];
  recommendationOptions: Option[];
  onSubmit: (answer: BudgetAnswer) => void;
  submitting: boolean;
}

const PRIMARY_BUTTON =
  "w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const CARD = "rounded border border-zinc-200 dark:border-zinc-700";

/** Investigation Budget-style question: spend a limited budget to reveal info, then recommend. */
export function BudgetQuestion({
  budgetAmount,
  investigations,
  recommendationOptions,
  onSubmit,
  submitting,
}: BudgetQuestionProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  const spent = investigations
    .filter((investigation) => selectedIds.includes(investigation.id))
    .reduce((sum, investigation) => sum + investigation.cost, 0);

  function toggle(id: string, cost: number) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((selectedId) => selectedId !== id);
      if (spent + cost > budgetAmount) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Orçamento: {spent} / {budgetAmount}
      </p>

      <div className="flex flex-col gap-2">
        {investigations.map((investigation) => {
          const checked = selectedIds.includes(investigation.id);
          const disabled = !checked && spent + investigation.cost > budgetAmount;
          return (
            <div key={investigation.id} className={`px-3 py-2 text-zinc-900 dark:text-zinc-100 ${CARD}`}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(investigation.id, investigation.cost)}
                />
                <span>
                  {investigation.label} — custo {investigation.cost}
                </span>
              </label>
              {checked && (
                <p className="mt-1 pl-6 text-sm text-zinc-500 dark:text-zinc-400">{investigation.revealText}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Recomendação final:</p>
      <div className="flex flex-col gap-2">
        {recommendationOptions.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            <input
              type="radio"
              name="recommendation"
              checked={recommendation === option.id}
              onChange={() => setRecommendation(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <button
        onClick={() =>
          recommendation &&
          onSubmit({ selectedInvestigationIds: selectedIds, recommendationOptionId: recommendation })
        }
        disabled={!recommendation || submitting}
        className={PRIMARY_BUTTON}
      >
        {submitting ? "Avaliando..." : "Enviar resposta"}
      </button>
    </div>
  );
}
