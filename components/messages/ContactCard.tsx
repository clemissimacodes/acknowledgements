import Link from "next/link";
import type { Note } from "@/lib/types";
import { cardDate, initialsFor } from "@/lib/format";
import { LockGlyph, MailGlyph, PhoneGlyph, VideoGlyph } from "./Icons";

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="card-row">
      <dt>{label}</dt>
      <dd>{value || "\u00a0"}</dd>
    </div>
  );
}

export function ContactCard({ note }: { note: Note }) {
  const known = cardDate(note.date);

  return (
    <div className="card">
      <header className="card-bar">
        <span />
        <Link className="card-done" href={`/acknowledgements/${note.slug}`}>
          Done
        </Link>
      </header>
      <div className="card-body">
        <div className="card-hero">
          <span className="avatar card-avatar" aria-hidden="true">
            {initialsFor(note.name)}
          </span>
          <h1 className="card-name">{note.name}</h1>
          {note.company ? <p className="card-role">{note.company}</p> : null}
          <p className="card-service">
            iMessage
            <LockGlyph />
            Encrypted
          </p>
        </div>
        <div className="card-actions" aria-hidden="true">
          <div className="card-action">
            <span className="card-action-btn">
              <PhoneGlyph />
            </span>
            <span>audio</span>
          </div>
          <div className="card-action">
            <span className="card-action-btn">
              <VideoGlyph />
            </span>
            <span>video</span>
          </div>
          <div className="card-action">
            <span className="card-action-btn">
              <MailGlyph />
            </span>
            <span>mail</span>
          </div>
        </div>
        <dl className="card-group">
          <Field label="first name" value={note.first} />
          <Field label="last name" value={note.last} />
          <Field label="company" value={note.company} />
        </dl>
        <dl className="card-group">
          <Field label="meeting place" value={note.place} />
          <Field label="known since" value={known} />
        </dl>
        <section className="card-notes" aria-label="Notes">
          <h2>Notes</h2>
          {note.notes ? <p>{note.notes}</p> : <p className="card-notes-empty">&nbsp;</p>}
        </section>
      </div>
    </div>
  );
}
