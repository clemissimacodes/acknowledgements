import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import {
  deletePoemNote,
  updatePoemNote,
  type PoemNoteKind,
} from "@/lib/poem-comments";

type UpdateNotePayload = {
  kind?: unknown;
  name?: unknown;
  body?: unknown;
};

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function owner() {
  return isAdminUser(await currentUser());
}

function cleanName(value: unknown) {
  const name = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!name) return null;
  if (name.length < 2 || /https?:\/\/|www\./i.test(name)) return undefined;
  return name;
}

function cleanBody(value: unknown) {
  const body = String(value ?? "").replace(/\0/g, "").trim().slice(0, 600);
  if (body.length < 2 || /https?:\/\/|www\./i.test(body)) return null;
  return body;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validOrigin(request) || !(await owner())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let payload: UpdateNotePayload;
  try {
    payload = (await request.json()) as UpdateNotePayload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = cleanName(payload.name);
  const body = cleanBody(payload.body);
  if (name === undefined || !body) {
    return NextResponse.json({ error: "Check the note." }, { status: 400 });
  }
  const kind: PoemNoteKind =
    payload.kind === "question" ? "question" : "note";

  try {
    const { id } = await params;
    const note = await updatePoemNote({ id, kind, name, body });
    if (!note) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "The note could not be edited." }, { status: 503 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validOrigin(request) || !(await owner())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const deleted = await deletePoemNote(id);
    if (!deleted) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "The note could not be deleted." }, { status: 503 });
  }
}
