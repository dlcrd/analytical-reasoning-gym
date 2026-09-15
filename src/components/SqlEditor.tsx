"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { insertTabAtCursor } from "@/lib/sql-editor";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** A SQL `<textarea>` where Tab indents the query instead of moving focus away. */
export function SqlEditor({ value, onChange, placeholder }: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null && textareaRef.current) {
      textareaRef.current.selectionStart = pendingCursorRef.current;
      textareaRef.current.selectionEnd = pendingCursorRef.current;
      pendingCursorRef.current = null;
    }
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const result = insertTabAtCursor(textarea.value, textarea.selectionStart, textarea.selectionEnd);
    pendingCursorRef.current = result.cursor;
    onChange(result.value);
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      rows={8}
      spellCheck={false}
      className="w-full rounded border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
      placeholder={placeholder}
    />
  );
}
