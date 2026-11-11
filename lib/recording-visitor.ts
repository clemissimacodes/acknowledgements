import "server-only";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { hashVisitor } from "@/lib/recordings";

const COOKIE = "vm_visitor";
const YEAR = 60 * 60 * 24 * 365;

/** Reads the anonymous visitor cookie, creating one when allowed. */
export async function visitorHash(options: { create?: boolean } = {}) {
  const jar = await cookies();
  let token = jar.get(COOKIE)?.value ?? "";
  if (!/^[a-f0-9-]{36}$/.test(token)) {
    if (!options.create) return null;
    token = randomUUID();
    try {
      jar.set(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: YEAR,
      });
    } catch {
      // Server components cannot set cookies; the hash is still usable.
    }
  }
  return hashVisitor(token);
}
