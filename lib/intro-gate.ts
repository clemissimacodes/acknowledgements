export const INTRO_COOKIE = "clementine_intro";
export const INTRO_COOKIE_VALUE = "open";

export function hasIntroductionCookie(value: string | undefined) {
  return value === INTRO_COOKIE_VALUE;
}

export function safeIntroductionNext(next: string | null) {
  if (!next || next.startsWith("//") || next.includes("://")) return "/poetry";
  if (next === "/poetry" || next.startsWith("/poetry/")) return next;
  if (
    next === "/acknowledgements" ||
    next.startsWith("/acknowledgements/")
  ) {
    return next;
  }
  return "/poetry";
}
