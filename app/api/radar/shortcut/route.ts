import {
  authorizeTrackerToken,
  geocodeShortcutCoordinates,
  storeCurrentLocation,
} from "@/lib/tracker";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

function response(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  let auth: Awaited<ReturnType<typeof authorizeTrackerToken>>;
  try {
    auth = await authorizeTrackerToken(token);
  } catch {
    return response({ error: "Tracker is temporarily unavailable." }, 503);
  }

  if (auth === "invalid") {
    return response({ error: "Unauthorized." }, 401);
  }
  if (auth === "rate-limited") {
    return response({ error: "Too many updates. Try again later." }, 429);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return response({ error: "Invalid request." }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: "Invalid request." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response({ error: "Invalid request." }, 400);
  }

  try {
    const record = body as Record<string, unknown>;
    const location = await geocodeShortcutCoordinates(
      record.latitude,
      record.longitude,
    );
    await storeCurrentLocation(location);
    return response(
      {
        ok: true,
        city: location.city,
        country: location.country,
        expiresInSeconds: 10_800,
      },
      200,
    );
  } catch {
    return response({ error: "Location update failed." }, 400);
  }
}

export function GET() {
  return response({ error: "Method not allowed." }, 405);
}
