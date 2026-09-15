import { describe, expect, it } from "vitest";

import { AUTH_COOKIE_NAME, isValidSessionToken, tokenForPassword } from "@/lib/auth-gate";

describe("tokenForPassword", () => {
  it("produces the same token for the same password", async () => {
    const a = await tokenForPassword("hunter2");
    const b = await tokenForPassword("hunter2");
    expect(a).toBe(b);
  });

  it("produces different tokens for different passwords", async () => {
    const a = await tokenForPassword("hunter2");
    const b = await tokenForPassword("hunter3");
    expect(a).not.toBe(b);
  });
});

describe("isValidSessionToken", () => {
  it("returns true when the token matches the password's token", async () => {
    const token = await tokenForPassword("hunter2");
    expect(await isValidSessionToken(token, "hunter2")).toBe(true);
  });

  it("returns false when the token does not match", async () => {
    expect(await isValidSessionToken("not-the-token", "hunter2")).toBe(false);
  });

  it("returns false when the token is missing", async () => {
    expect(await isValidSessionToken(undefined, "hunter2")).toBe(false);
    expect(await isValidSessionToken(null, "hunter2")).toBe(false);
    expect(await isValidSessionToken("", "hunter2")).toBe(false);
  });
});

describe("AUTH_COOKIE_NAME", () => {
  it("is a stable, non-empty cookie name", () => {
    expect(AUTH_COOKIE_NAME).toBe("arg_session");
  });
});
