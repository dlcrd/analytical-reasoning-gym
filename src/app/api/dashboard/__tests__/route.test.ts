import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = { marker: "fake-db" };

vi.mock("@/db/client", () => ({
  getDb: vi.fn(async () => mockDb),
}));

vi.mock("@/lib/dashboard", () => ({
  computeDashboard: vi.fn(async () => ({
    streakDays: 3,
    skills: [{ key: "grain", label: "Grain", correct: 2, total: 4, accuracy: 0.5 }],
    levelsByMode: { metric_lab: 4, granularity_trainer: 4, query_architecture: 4, sql_build: 5 },
  })),
}));

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to computeDashboard and returns its result as JSON", async () => {
    const { GET } = await import("../route");
    const { computeDashboard } = await import("@/lib/dashboard");

    const response = await GET();
    const body = await response.json();

    expect(computeDashboard).toHaveBeenCalledWith(mockDb);
    expect(body.streakDays).toBe(3);
    expect(body.skills).toHaveLength(1);
    expect(body.levelsByMode.sql_build).toBe(5);
  });
});
