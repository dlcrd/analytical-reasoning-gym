import { NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_COOKIE_NAME, tokenForPassword } from "@/lib/auth-gate";

const loginSchema = z.object({
  password: z.string().min(1),
});

/**
 * Validates the submitted password against `SITE_PASSWORD` and, on success,
 * sets the session cookie the middleware gate checks on every request.
 *
 * Args:
 *     request: The incoming POST request with a JSON `{ password }` body.
 *
 * Returns:
 *     204 with the session cookie set on success, 401 on a wrong password,
 *     or 500 if `SITE_PASSWORD` isn't configured on the server.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.json({ error: "SITE_PASSWORD not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }

  if (parsed.data.password !== sitePassword) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await tokenForPassword(sitePassword);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
