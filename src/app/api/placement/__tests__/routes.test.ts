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
  completePlacementSession: vi.fn(async () => ({
    metric_lab: 3,
    granularity_trainer: 3,
    query_architecture: 3,
    sql_build: 5,
  })),
  recordPlacementAttempt: vi.fn(async (_db: unknown, sessionId: string, input: { exerciseId: string }) => {
    if (input.exerciseId === "does-not-exist") {
      throw new Error('recordPlacementAttempt: unknown exercise "does-not-exist"');
    }
  }),
  getActivePlacementSession: vi.fn(async () => null),
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

describe("GET /api/placement/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to getActivePlacementSession and returns its result as JSON", async () => {
    const { GET } = await import("../active/route");
    const { getActivePlacementSession } = await import("@/lib/sessions");

    const response = await GET();
    const body = await response.json();

    expect(getActivePlacementSession).toHaveBeenCalledWith(mockDb);
    expect(body).toBeNull();
  });
});

describe("POST /api/placement/attempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/placement/attempt", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("delegates to recordPlacementAttempt with the parsed body", async () => {
    const { POST } = await import("../attempt/route");
    const { recordPlacementAttempt } = await import("@/lib/sessions");

    const response = await POST(
      makeRequest({
        sessionId: "11111111-1111-4111-8111-111111111111",
        exerciseId: "ex-1",
        isCorrect: true,
        feedbackChecklist: { sqlSyntax: true },
      }),
    );
    const body = await response.json();

    expect(recordPlacementAttempt).toHaveBeenCalledWith(mockDb, "11111111-1111-4111-8111-111111111111", {
      sessionId: "11111111-1111-4111-8111-111111111111",
      exerciseId: "ex-1",
      isCorrect: true,
      feedbackChecklist: { sqlSyntax: true },
    });
    expect(body.ok).toBe(true);
  });

  it("returns 400 without touching the db when the body fails validation", async () => {
    const { POST } = await import("../attempt/route");
    const { recordPlacementAttempt } = await import("@/lib/sessions");

    const response = await POST(makeRequest({ sessionId: "not-a-uuid" }));

    expect(response.status).toBe(400);
    expect(recordPlacementAttempt).not.toHaveBeenCalled();
  });

  it("returns 404 when the exercise id is unknown", async () => {
    const { POST } = await import("../attempt/route");

    const response = await POST(
      makeRequest({
        sessionId: "11111111-1111-4111-8111-111111111111",
        exerciseId: "does-not-exist",
        isCorrect: true,
        feedbackChecklist: {},
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("POST /api/placement/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to completePlacementSession with just the sessionId", async () => {
    const { POST } = await import("../submit/route");
    const { completePlacementSession } = await import("@/lib/sessions");

    const request = new Request("http://localhost/api/placement/submit", {
      method: "POST",
      body: JSON.stringify({ sessionId: "11111111-1111-4111-8111-111111111111" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(completePlacementSession).toHaveBeenCalledWith(mockDb, "11111111-1111-4111-8111-111111111111");
    expect(body.levelsByMode.sql_build).toBe(5);
  });

  it("returns 400 without touching the db when the body fails validation", async () => {
    const { POST } = await import("../submit/route");
    const { completePlacementSession } = await import("@/lib/sessions");

    const request = new Request("http://localhost/api/placement/submit", {
      method: "POST",
      body: JSON.stringify({ sessionId: "not-a-uuid" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(completePlacementSession).not.toHaveBeenCalled();
  });
});
