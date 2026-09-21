export const SECRETS_COOKIE = "secrets_ok_v4";
export const OLD_SECRETS_COOKIES = ["cia_ok", "cia_ok_v2", "cia_ok_v3"] as const;
export const GUEST_COOKIE = "secrets_guest";
export const SECRETS_SESSION_HOURS = 12;

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) =>
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

async function digest(value: string) {
  return hex(
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`clemissima-secrets-v4:${value}`),
    ),
  );
}

// The signing key mixes the password with a server-only secret, so a copy of
// this repository plus a correct guess is still not enough to mint a cookie
// offline — the server has to hand one out.
async function signingKey(password: string) {
  const secret =
    process.env.SECRETS_COOKIE_SECRET?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    "";
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`clemissima-secrets-v4:${password}:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(password: string, payload: string) {
  const key = await signingKey(password);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

export async function createSecretsCookieValue(password: string) {
  const expires = Date.now() + SECRETS_SESSION_HOURS * 60 * 60 * 1000;
  const payload = `v4.${expires}`;
  return `${payload}.${await sign(password, payload)}`;
}

export async function hasSecretsCookie(
  value: string | undefined,
  password: string | undefined,
) {
  if (!value || !password) return false;
  const [version, expiresRaw, signature, ...rest] = value.split(".");
  if (version !== "v4" || !expiresRaw || !signature || rest.length) return false;
  const expires = Number(expiresRaw);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) return false;
  const expected = await sign(password, `v4.${expires}`);
  return constantTimeEqual(signature, expected);
}

export async function passwordsMatch(provided: string, expected: string) {
  const [providedDigest, expectedDigest] = await Promise.all([
    digest(provided),
    digest(expected),
  ]);
  return constantTimeEqual(providedDigest, expectedDigest);
}
