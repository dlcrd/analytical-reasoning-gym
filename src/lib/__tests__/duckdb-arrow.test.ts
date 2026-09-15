import { describe, expect, it } from "vitest";
import { arrowTableToQueryResult, type ArrowLikeTable } from "../duckdb-arrow";

describe("arrowTableToQueryResult", () => {
  it("converts column order and row objects into a plain QueryResult", () => {
    const fakeTable: ArrowLikeTable = {
      schema: { fields: [{ name: "channel" }, { name: "n" }] },
      toArray: () => [
        { channel: "web", n: 10 },
        { channel: "app", n: 5 },
      ],
    };

    expect(arrowTableToQueryResult(fakeTable)).toEqual({
      columns: ["channel", "n"],
      rows: [
        ["web", 10],
        ["app", 5],
      ],
    });
  });

  it("handles an empty result", () => {
    const fakeTable: ArrowLikeTable = {
      schema: { fields: [{ name: "n" }] },
      toArray: () => [],
    };

    expect(arrowTableToQueryResult(fakeTable)).toEqual({ columns: ["n"], rows: [] });
  });
});
