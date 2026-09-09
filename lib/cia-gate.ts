export const CIA_COOKIE = "cia_ok_v3";
export const OLD_CIA_COOKIES = ["cia_ok", "cia_ok_v2"] as const;

async function digest(value: string) {
  const bytes = new TextEncoder().encode(`clemissima-secrets-v3:${value}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createCiaCookieValue(password: string) {
  return `v3.${await digest(password)}`;
}

export async function hasCiaCookie(
  value: string | undefined,
  password: string | undefined,
) {
  if (!value || !password) return false;
  const expected = await createCiaCookieValue(password);
  return constantTimeEqual(value, expected);
}

export async function passwordsMatch(provided: string, expected: string) {
  const [providedDigest, expectedDigest] = await Promise.all([
    digest(provided),
    digest(expected),
  ]);
  return constantTimeEqual(providedDigest, expectedDigest);
}

export function safeProtectedNext(next: string | null): string {
  const fallback = "/secrets";
  if (!next || next.includes("\\")) return fallback;

  try {
    const base = new URL("https://cia.local");
    const destination = new URL(next, base);
    const isProtectedPath =
      destination.pathname === "/secrets" ||
      destination.pathname.startsWith("/secrets/") ||
      destination.pathname === "/cia" ||
      destination.pathname.startsWith("/cia/") ||
      destination.pathname === "/acknowledgements" ||
      destination.pathname.startsWith("/acknowledgements/");

    if (destination.origin !== base.origin || !isProtectedPath) return fallback;

    const pathname = destination.pathname.replace(/^\/cia(?=\/|$)/, "/secrets");
    return `${pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
