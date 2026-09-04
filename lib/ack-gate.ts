export const ACK_COOKIE = "ack_ok";
export const ACK_COOKIE_VALUE = "open";

export function checkAcknowledgementsPassword(password: string): boolean {
  return password.trim() === "mmmm";
}

export function hasAcknowledgementsCookie(value: string | undefined): boolean {
  return value === ACK_COOKIE_VALUE;
}

export function safeAcknowledgementsNext(next: string | null): string {
  if (!next || !next.startsWith("/acknowledgements")) return "/acknowledgements";
  if (next.startsWith("//") || next.includes("://")) return "/acknowledgements";
  return next;
}
