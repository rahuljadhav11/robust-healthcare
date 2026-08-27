import { auth, currentUser } from "@clerk/nextjs/server";

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export type AuthStatus = "unauthenticated" | "unauthorized" | "ok";

/**
 * Signed-in alone isn't enough — this app also enforces an email allowlist
 * (ALLOWED_EMAILS, comma-separated) so anyone who signs up via Clerk doesn't
 * automatically get access. If ALLOWED_EMAILS is unset, any signed-in user
 * is allowed (matches pre-allowlist behavior).
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const { userId } = await auth();
  if (!userId) return "unauthenticated";

  const allowed = getAllowedEmails();
  if (allowed.length === 0) return "ok";

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  return email && allowed.includes(email) ? "ok" : "unauthorized";
}

/** For API routes: returns the userId if allowed, or a ready-to-return NextResponse init if not. */
export async function requireAuthorizedUserId(): Promise<
  { userId: string; response?: undefined } | { userId?: undefined; response: { error: string; status: number } }
> {
  const status = await getAuthStatus();
  if (status === "unauthenticated") return { response: { error: "Unauthorized", status: 401 } };
  if (status === "unauthorized") return { response: { error: "Forbidden", status: 403 } };

  const { userId } = await auth();
  return { userId: userId! };
}
