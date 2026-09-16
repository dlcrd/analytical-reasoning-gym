import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-grading", () => ({
  gradeAttempt: vi.fn(async (exerciseId: string) => {
    if (exerciseId === "does-not-exist") {
      throw new Error('computeReferenceResult: unknown exercise "does-not-exist"');
    }
    return { matches: true };
  }),
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/exercises/some-id/grade", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/exercises/[id]/grade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to gradeAttempt with the exercise id and parsed body", async () => {
    const { POST } = await import("../route");
    const { gradeAttempt } = await import("@/lib/server-grading");

    const response = await POST(makeRequest({ type: "sql", columns: ["n"], rows: [[1]] }), {
      params: Promise.resolve({ id: "some-id" }),
    });
    const body = await response.json();

    expect(gradeAttempt).toHaveBeenCalledWith("some-id", { type: "sql", columns: ["n"], rows: [[1]] });
    expect(body.matches).toBe(true);
  });

  it("delegates a multiple_choice answer the same way", async () => {
    const { POST } = await import("../route");
    const { gradeAttempt } = await import("@/lib/server-grading");

    const response = await POST(makeRequest({ type: "multiple_choice", selectedOptionId: "b" }), {
      params: Promise.resolve({ id: "some-id" }),
    });

    expect(response.status).toBe(200);
    expect(gradeAttempt).toHaveBeenCalledWith("some-id", { type: "multiple_choice", selectedOptionId: "b" });
  });

  it("returns 400 on a malformed body without calling gradeAttempt", async () => {
    const { POST } = await import("../route");
    const { gradeAttempt } = await import("@/lib/server-grading");

    const response = await POST(makeRequest({ columns: "not-an-array" }), {
      params: Promise.resolve({ id: "some-id" }),
    });

    expect(response.status).toBe(400);
    expect(gradeAttempt).not.toHaveBeenCalled();
  });

  it("returns 404 when the exercise id is unknown", async () => {
    const { POST } = await import("../route");

    const response = await POST(makeRequest({ type: "sql", columns: [], rows: [] }), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });

    expect(response.status).toBe(404);
  });
});
