import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = { marker: "fake-db" };

vi.mock("@/db/client", () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock("@/lib/sessions", () => ({
  startPlacementSession: vi.fn(async () => ({
    sessionId: "session-1",
    exercises: [{ id: "ex-1", mode: "sql_build", domain: "ecommerce", level: 4 }],
  })),
  finalizePlacementSession: vi.fn(async () => ({
    metric_lab: 3,
    granularity_trainer: 3,
    query_architecture: 3,
    sql_build: 5,
  })),
}));

describe("POST /api/placement/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to startPlacementSession and returns its result as JSON", async () => {
    const { POST } = await import("../start/route");
    const { startPlacementSession } = await import("@/lib/sessions");

    const response = await POST();
    const body = await response.json();

    expect(startPlacementSession).toHaveBeenCalledWith(mockDb);
    expect(body.sessionId).toBe("session-1");
    expect(body.exercises).toHaveLength(1);
  });
});

describe("POST /api/placement/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to finalizePlacementSession with the parsed body", async () => {
    const { POST } = await import("../submit/route");
    const { finalizePlacementSession } = await import("@/lib/sessions");

    const request = new Request("http://localhost/api/placement/submit", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "11111111-1111-4111-8111-111111111111",
        attempts: [{ exerciseId: "ex-1", isCorrect: true, feedbackChecklist: { sqlSyntax: true } }],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(finalizePlacementSession).toHaveBeenCalledWith(
      mockDb,
      "11111111-1111-4111-8111-111111111111",
      [{ exerciseId: "ex-1", isCorrect: true, feedbackChecklist: { sqlSyntax: true } }],
    );
    expect(body.levelsByMode.sql_build).toBe(5);
  });

  it("returns 400 without touching the db when the body fails validation", async () => {
    const { POST } = await import("../submit/route");
    const { finalizePlacementSession } = await import("@/lib/sessions");

    const request = new Request("http://localhost/api/placement/submit", {
      method: "POST",
      body: JSON.stringify({ sessionId: "not-a-uuid", attempts: [] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(finalizePlacementSession).not.toHaveBeenCalled();
  });
});
