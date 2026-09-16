"use client";

import { useState } from "react";

interface Step {
  id: string;
  label: string;
}

interface OrderingQuestionProps {
  steps: Step[];
  onSubmit: (order: string[]) => void;
  submitting: boolean;
}

const PRIMARY_BUTTON =
  "w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const MOVE_BUTTON =
  "rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-200";

/** Reorder via up/down buttons rather than drag-and-drop — same mechanic, no extra dependency. */
export function OrderingQuestion({ steps, onSubmit, submitting }: OrderingQuestionProps) {
  const [order, setOrder] = useState<Step[]>(steps);

  function moveUp(index: number) {
    if (index === 0) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    if (index === order.length - 1) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2">
        {order.map((step, i) => (
          <li
            key={step.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            <span>
              {i + 1}. {step.label}
            </span>
            <span className="flex gap-1">
              <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className={MOVE_BUTTON}>
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i === order.length - 1}
                className={MOVE_BUTTON}
              >
                ▼
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button
        onClick={() => onSubmit(order.map((step) => step.id))}
        disabled={submitting}
        className={PRIMARY_BUTTON}
      >
        {submitting ? "Avaliando..." : "Enviar resposta"}
      </button>
    </div>
  );
}
