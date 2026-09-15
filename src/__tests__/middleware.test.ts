import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AUTH_COOKIE_NAME, tokenForPassword } from "@/lib/auth-gate";
import { middleware } from "../../middleware";

describe("middleware (password gate)", () => {
  const originalPassword = process.env.SITE_PASSWORD;

  afterEach(() => {
    process.env.SITE_PASSWORD = originalPassword;
  });

  it("passes requests through untouched when SITE_PASSWORD isn't set", async () => {
    delete process.env.SITE_PASSWORD;
    const request = new NextRequest("http://localhost/dashboard");

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });

  describe("with SITE_PASSWORD configured", () => {
    beforeEach(() => {
      process.env.SITE_PASSWORD = "correct-horse";
    });

    it("redirects to /login when there is no session cookie", async () => {
      const request = new NextRequest("http://localhost/dashboard");

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe("/dashboard");
    });

    it("redirects to /login when the session cookie is wrong", async () => {
      const request = new NextRequest("http://localhost/dashboard", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=bogus` },
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
    });

    it("passes through when the session cookie is valid", async () => {
      const token = await tokenForPassword("correct-horse");
      const request = new NextRequest("http://localhost/dashboard", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });

      const response = await middleware(request);

      expect(response.headers.get("location")).toBeNull();
    });
  });
});
