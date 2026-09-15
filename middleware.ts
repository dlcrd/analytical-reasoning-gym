import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth-gate";

/**
 * Gates every request behind a single shared password when `SITE_PASSWORD`
 * is configured. Local dev with no `SITE_PASSWORD` set stays open.
 *
 * Args:
 *     request: The incoming request.
 *
 * Returns:
 *     The request unchanged if authorized (or no password configured),
 *     otherwise a redirect to `/login`.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (await isValidSessionToken(token, sitePassword)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|api/auth/login|_next/static|_next/image|favicon.ico).*)"],
};
