import { describe, expect, it } from "vitest";

import { insertTabAtCursor } from "@/lib/sql-editor";

describe("insertTabAtCursor", () => {
  it("inserts two spaces at the cursor position when there's no selection", () => {
    const result = insertTabAtCursor("SELECT 1", 6, 6);
    expect(result.value).toBe("SELECT   1");
    expect(result.cursor).toBe(8);
  });

  it("replaces a selection with two spaces", () => {
    const result = insertTabAtCursor("SELECT foo FROM bar", 7, 10);
    expect(result.value).toBe("SELECT    FROM bar");
    expect(result.cursor).toBe(9);
  });

  it("inserts at the start of the string", () => {
    const result = insertTabAtCursor("SELECT 1", 0, 0);
    expect(result.value).toBe("  SELECT 1");
    expect(result.cursor).toBe(2);
  });

  it("inserts at the end of the string", () => {
    const result = insertTabAtCursor("SELECT 1", 8, 8);
    expect(result.value).toBe("SELECT 1  ");
    expect(result.cursor).toBe(10);
  });
});
