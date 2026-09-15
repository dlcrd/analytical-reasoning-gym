import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AUTH_COOKIE_NAME, tokenForPassword } from "@/lib/auth-gate";

function postWith(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  const originalPassword = process.env.SITE_PASSWORD;

  beforeEach(() => {
    process.env.SITE_PASSWORD = "correct-horse";
  });

  afterEach(() => {
    process.env.SITE_PASSWORD = originalPassword;
  });

  it("sets the session cookie and returns 204 for the right password", async () => {
    const { POST } = await import("../route");

    const response = await POST(postWith({ password: "correct-horse" }));

    expect(response.status).toBe(204);
    const expectedToken = await tokenForPassword("correct-horse");
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe(expectedToken);
  });

  it("returns 401 for the wrong password without setting a cookie", async () => {
    const { POST } = await import("../route");

    const response = await POST(postWith({ password: "wrong" }));

    expect(response.status).toBe(401);
    expect(response.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("returns 400 when the password field is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(postWith({}));

    expect(response.status).toBe(400);
  });

  it("returns 500 when SITE_PASSWORD isn't configured", async () => {
    delete process.env.SITE_PASSWORD;
    const { POST } = await import("../route");

    const response = await POST(postWith({ password: "anything" }));

    expect(response.status).toBe(500);
  });
});
