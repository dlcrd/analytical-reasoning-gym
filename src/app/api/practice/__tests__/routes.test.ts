import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = { marker: "fake-db" };

vi.mock("@/db/client", () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock("@/lib/sessions", () => ({
  startPracticeSession: vi.fn(async () => ({
    sessionId: "session-1",
    currentLevel: 4,
    levelStreak: 0,
    exercise: { id: "ex-1", mode: "metric_lab", domain: "ecommerce", level: 4 },
  })),
  recordPracticeAttempt: vi.fn(async (_db: unknown, input: { exerciseId: string }) => {
    if (input.exerciseId === "does-not-exist") {
      throw new Error('recordPracticeAttempt: unknown exercise "does-not-exist"');
    }
    return {
      currentLevel: 5,
      levelStreak: 0,
      leveledUp: true,
      nextExercise: { id: "ex-2", mode: "metric_lab", domain: "ecommerce", level: 5 },
    };
  }),
}));

describe("POST /api/practice/[mode]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to startPracticeSession with the mode from the URL", async () => {
    const { POST } = await import("../[mode]/start/route");
    const { startPracticeSession } = await import("@/lib/sessions");

    const response = await POST(new Request("http://localhost/api/practice/metric_lab/start", { method: "POST" }), {
      params: Promise.resolve({ mode: "metric_lab" }),
    });
    const body = await response.json();

    expect(startPracticeSession).toHaveBeenCalledWith(mockDb, "metric_lab");
    expect(body.sessionId).toBe("session-1");
    expect(body.exercise.id).toBe("ex-1");
  });

  it("returns 400 for an unknown mode without touching the db", async () => {
    const { POST } = await import("../[mode]/start/route");
    const { startPracticeSession } = await import("@/lib/sessions");

    const response = await POST(new Request("http://localhost/api/practice/not-a-mode/start", { method: "POST" }), {
      params: Promise.resolve({ mode: "not-a-mode" }),
    });

    expect(response.status).toBe(400);
    expect(startPracticeSession).not.toHaveBeenCalled();
  });
});

describe("POST /api/practice/[mode]/attempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to recordPracticeAttempt with the parsed body", async () => {
    const { POST } = await import("../[mode]/attempt/route");
    const { recordPracticeAttempt } = await import("@/lib/sessions");

    const request = new Request("http://localhost/api/practice/metric_lab/attempt", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "11111111-1111-4111-8111-111111111111",
        exerciseId: "ex-1",
        isCorrect: true,
        feedbackChecklist: { sqlSyntax: true, result: true },
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ mode: "metric_lab" }) });
    const body = await response.json();

    expect(recordPracticeAttempt).toHaveBeenCalledWith(mockDb, {
      sessionId: "11111111-1111-4111-8111-111111111111",
      exerciseId: "ex-1",
      isCorrect: true,
      feedbackChecklist: { sqlSyntax: true, result: true },
    });
    expect(body.currentLevel).toBe(5);
    expect(body.leveledUp).toBe(true);
  });

  it("returns 400 without touching the db when the body fails validation", async () => {
    const { POST } = await import("../[mode]/attempt/route");
    const { recordPracticeAttempt } = await import("@/lib/sessions");

    const request = new Request("http://localhost/api/practice/metric_lab/attempt", {
      method: "POST",
      body: JSON.stringify({ sessionId: "not-a-uuid" }),
    });

    const response = await POST(request, { params: Promise.resolve({ mode: "metric_lab" }) });

    expect(response.status).toBe(400);
    expect(recordPracticeAttempt).not.toHaveBeenCalled();
  });

  it("returns 404 when the exercise id is unknown", async () => {
    const { POST } = await import("../[mode]/attempt/route");

    const request = new Request("http://localhost/api/practice/metric_lab/attempt", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "11111111-1111-4111-8111-111111111111",
        exerciseId: "does-not-exist",
        isCorrect: true,
        feedbackChecklist: {},
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ mode: "metric_lab" }) });

    expect(response.status).toBe(404);
  });
});
