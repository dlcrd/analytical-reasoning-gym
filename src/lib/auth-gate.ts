/** Name of the cookie that carries the password-gate session token. */
export const AUTH_COOKIE_NAME = "arg_session";

/**
 * Derives a stable session token from the site password.
 *
 * The raw password is never stored in the cookie, only this derived token,
 * so it isn't readable from devtools/document.cookie in plain text.
 *
 * Args:
 *     password: The site password (from the `SITE_PASSWORD` env var).
 *
 * Returns:
 *     A hex-encoded SHA-256 digest of the password.
 */
export async function tokenForPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Checks whether a session token cookie is valid for the given password.
 *
 * Args:
 *     token: The value of the session cookie, if present.
 *     password: The site password to validate against.
 *
 * Returns:
 *     True if the token matches the expected token for the password.
 */
export async function isValidSessionToken(
  token: string | undefined | null,
  password: string,
): Promise<boolean> {
  if (!token) {
    return false;
  }
  const expected = await tokenForPassword(password);
  return token === expected;
}
