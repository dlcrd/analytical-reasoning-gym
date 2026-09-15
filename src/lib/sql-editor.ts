/** Result of inserting an indent at (or replacing a selection with) a cursor position. */
export interface TabInsertResult {
  value: string;
  cursor: number;
}

const INDENT = "  ";

/**
 * Inserts a two-space indent at the cursor, or replaces the current selection with it.
 *
 * Used to make the Tab key indent SQL in a plain `<textarea>` instead of moving focus
 * to the next element, which is the browser's default behavior.
 *
 * Args:
 *     value: The textarea's current text.
 *     selectionStart: Start of the current selection (or cursor position if collapsed).
 *     selectionEnd: End of the current selection (or cursor position if collapsed).
 *
 * Returns:
 *     The new text and the cursor position the caret should move to afterwards.
 */
export function insertTabAtCursor(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TabInsertResult {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  return {
    value: `${before}${INDENT}${after}`,
    cursor: before.length + INDENT.length,
  };
}
