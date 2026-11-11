import Link from "next/link";
import {
  destroyForm,
  moveToTrashForm,
  removeNoteForm,
  removeReplyForm,
  renameRecording,
  restoreForm,
  toggleFavoriteForm,
} from "@/app/(volume)/voice-memos/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Publisher } from "@/components/voice-memos/Publisher";
import {
  listAllNotes,
  listAllReplies,
  listRecordings,
} from "@/lib/recordings";
import {
  FOLDER_LABELS,
  RECORDING_FOLDERS,
  formatClock,
  type Recording,
} from "@/lib/recording-types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Voice Memos · Control room",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Los_Angeles",
});

function localInput(value: string) {
  // datetime-local wants local wall time without a zone; render in LA.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

function RecordingCard({ item, trashed }: { item: Recording; trashed: boolean }) {
  return (
    <article className="admin-ask admin-recording" id={item.id}>
      <p className="admin-muted">
        {dateFormat.format(new Date(item.recordedAt))} · {formatClock(item.durationMs)} ·{" "}
        {item.hearts} hearts · {item.noteCount} notes · {item.replyCount} replies
        {trashed ? null : (
          <>
            {" "}
            · <Link href={`/voice-memos/${item.slug}`}>page</Link>
          </>
        )}
      </p>
      {trashed ? (
        <>
          <strong>{item.title}</strong>
          <div className="admin-roll-actions">
            <form action={restoreForm}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit">Restore</button>
            </form>
            <form action={destroyForm}>
              <input type="hidden" name="id" value={item.id} />
              <ConfirmButton
                className="admin-danger"
                message="Delete this recording forever, including its audio file, notes and replies?"
              >
                Delete forever
              </ConfirmButton>
            </form>
          </div>
        </>
      ) : (
        <>
          <form action={renameRecording} className="admin-edit-form admin-recording-form">
            <input type="hidden" name="id" value={item.id} />
            <label>
              Title
              <input name="title" defaultValue={item.title} maxLength={120} required />
            </label>
            <label>
              Folder
              <select name="folder" defaultValue={item.folder}>
                {RECORDING_FOLDERS.map((folder) => (
                  <option key={folder} value={folder}>
                    {FOLDER_LABELS[folder]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recorded
              <input
                type="datetime-local"
                name="recordedAt"
                defaultValue={localInput(item.recordedAt)}
              />
            </label>
            <div className="admin-roll-actions">
              <button type="submit">Save</button>
            </div>
          </form>
          <div className="admin-roll-actions">
            <form action={toggleFavoriteForm}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit">
                {item.favorite ? "♥ Favorite — remove" : "♡ Add to Favorites"}
              </button>
            </form>
            <form action={moveToTrashForm}>
              <input type="hidden" name="id" value={item.id} />
              <ConfirmButton
                className="admin-danger"
                message="Move this recording to Recently Deleted? It is kept for 30 days."
              >
                Delete
              </ConfirmButton>
            </form>
          </div>
        </>
      )}
    </article>
  );
}

export default async function VoiceMemosControlPage() {
  const [live, trashed, notes, replies] = await Promise.all([
    listRecordings().catch(() => []),
    listRecordings({ trash: true }).catch(() => []),
    listAllNotes().catch(() => []),
    listAllReplies().catch(() => []),
  ]);
  const titles = new Map([...live, ...trashed].map((item) => [item.id, item.title]));

  return (
    <main className="admin-page admin-rolls">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">
            <Link href="/controlroom">Control room</Link> · voice memos
          </p>
          <h1>Voice Memos</h1>
          <p className="admin-private">
            Upload memos from the Apple app and they appear on the public page
            instantly. Waveforms are computed here in your browser at upload.
            Deleted memos sit in Recently Deleted for 30 days, like the app.
          </p>
        </div>
        <Link href="/voice-memos">Open the app →</Link>
      </header>

      <section className="admin-section">
        <h2>Publish</h2>
        <Publisher />
      </section>

      <section className="admin-section">
        <h2>All Recordings ({live.length})</h2>
        {live.length ? (
          <div className="admin-ask-list">
            {live.map((item) => (
              <RecordingCard key={item.id} item={item} trashed={false} />
            ))}
          </div>
        ) : (
          <p className="admin-muted">Nothing published yet.</p>
        )}
      </section>

      {trashed.length ? (
        <section className="admin-section">
          <h2>Recently Deleted ({trashed.length})</h2>
          <div className="admin-ask-list">
            {trashed.map((item) => (
              <RecordingCard key={item.id} item={item} trashed />
            ))}
          </div>
        </section>
      ) : null}

      {notes.length ? (
        <section className="admin-section">
          <h2>Notes from visitors ({notes.length})</h2>
          <div className="admin-ask-list">
            {notes.map((note) => (
              <article className="admin-ask" key={note.id}>
                <p className="admin-muted">
                  {dateFormat.format(new Date(note.createdAt))} · {note.name ?? "anonymous"} · on{" "}
                  <em>{titles.get(note.recordingId) ?? "a deleted recording"}</em>
                </p>
                <blockquote>{note.body}</blockquote>
                <form action={removeNoteForm}>
                  <input type="hidden" name="id" value={note.id} />
                  <ConfirmButton className="admin-danger" message="Delete this note?">
                    Delete
                  </ConfirmButton>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {replies.length ? (
        <section className="admin-section">
          <h2>Voice replies ({replies.length})</h2>
          <div className="admin-ask-list">
            {replies.map((reply) => (
              <article className="admin-ask" key={reply.id}>
                <p className="admin-muted">
                  {dateFormat.format(new Date(reply.createdAt))} · {reply.name ?? "anonymous"} ·{" "}
                  {formatClock(reply.durationMs)} · on{" "}
                  <em>{titles.get(reply.recordingId) ?? "a deleted recording"}</em>
                </p>
                <audio controls preload="none" src={reply.url} />
                <form action={removeReplyForm}>
                  <input type="hidden" name="id" value={reply.id} />
                  <ConfirmButton className="admin-danger" message="Delete this voice reply?">
                    Delete
                  </ConfirmButton>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
