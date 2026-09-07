export const CIA_COOKIE = "cia_ok";
export const CIA_COOKIE_VALUE = "cleared";

export function hasCiaCookie(value: string | undefined): boolean {
  return value === CIA_COOKIE_VALUE;
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
