import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  GUEST_COOKIE,
  OLD_SECRETS_COOKIES,
  SECRETS_COOKIE,
  SECRETS_SESSION_HOURS,
  createSecretsCookieValue,
  passwordsMatch,
} from "@/lib/secrets-gate";
import {
  assessSecretsThrottle,
  hashIp,
  isGuestId,
  newGuestId,
  recordSecretsAttempt,
  requestIp,
  type SecretsOutcome,
} from "@/lib/secrets-attempts";

export const runtime = "nodejs";

// Every answer takes about the same time whether the guess was right, wrong,
// or blocked, so response timing leaks nothing.
const MIN_RESPONSE_MS = 1100;
const JITTER_MS = 250;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

async function settle(startedAt: number) {
  const target = MIN_RESPONSE_MS + Math.random() * JITTER_MS;
  const remaining = target - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

function withGuestCookie(response: NextResponse, guestId: string) {
  response.cookies.set(GUEST_COOKIE, guestId, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 400,
  });
  return response;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
  }

  let guess = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    guess = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const expectedPassword = process.env.CIA_PASSWORD?.trim();
  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Secrets access is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const existingGuest = readCookie(request, GUEST_COOKIE);
  const guestId = isGuestId(existingGuest) ? existingGuest : newGuestId();
  const identity = { guestId, ipHash: hashIp(requestIp(request)) };

  let clerkUserId: string | null = null;
  let clerkEmail: string | null = null;
  try {
    const user = await currentUser();
    clerkUserId = user?.id ?? null;
    clerkEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  } catch {
    // Anonymous guessers are the norm.
  }

  async function record(outcome: SecretsOutcome) {
    try {
      await recordSecretsAttempt({
        identity,
        request,
        guess,
        outcome,
        clerkUserId,
        clerkEmail,
      });
    } catch (error) {
      console.error("secrets attempt log failed", error);
    }
  }

  // If the throttle store cannot be consulted, fail closed.
  let verdict: Awaited<ReturnType<typeof assessSecretsThrottle>>;
  try {
    verdict = await assessSecretsThrottle(identity);
  } catch (error) {
    console.error("secrets throttle unavailable", error);
    verdict = { locked: true, reason: "global", retryAfterSeconds: 600 };
  }

  if (verdict.locked) {
    await record("locked");
    await settle(startedAt);
    return withGuestCookie(
      NextResponse.json(
        { error: "locked", retryAfterSeconds: verdict.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(verdict.retryAfterSeconds),
          },
        },
      ),
      guestId,
    );
  }

  const correct = await passwordsMatch(guess.trim(), expectedPassword);
  await record(correct ? "cracked" : "wrong");
  await settle(startedAt);

  if (!correct) {
    return withGuestCookie(
      NextResponse.json(
        { error: "wrong" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
      guestId,
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(
    SECRETS_COOKIE,
    await createSecretsCookieValue(expectedPassword),
    { ...cookieBase, maxAge: SECRETS_SESSION_HOURS * 60 * 60 },
  );
  for (const oldCookie of OLD_SECRETS_COOKIES) {
    response.cookies.set(oldCookie, "", { ...cookieBase, maxAge: 0 });
  }
  return withGuestCookie(response, guestId);
}
