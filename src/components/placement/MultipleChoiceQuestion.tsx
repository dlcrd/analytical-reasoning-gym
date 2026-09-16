"use client";

import { useState } from "react";

interface Option {
  id: string;
  label: string;
}

interface MultipleChoiceQuestionProps {
  options: Option[];
  onSubmit: (selectedOptionId: string) => void;
  submitting: boolean;
}

const PRIMARY_BUTTON =
  "w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export function MultipleChoiceQuestion({ options, onSubmit, submitting }: MultipleChoiceQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            <input
              type="radio"
              name="option"
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <button
        onClick={() => selected && onSubmit(selected)}
        disabled={!selected || submitting}
        className={PRIMARY_BUTTON}
      >
        {submitting ? "Avaliando..." : "Enviar resposta"}
      </button>
    </div>
  );
}
