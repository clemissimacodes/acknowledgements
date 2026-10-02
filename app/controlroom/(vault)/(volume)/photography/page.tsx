import Link from "next/link";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { RollUploader } from "@/components/admin/RollUploader";
import { listAllRolls, ROLL_MAX_FRAMES } from "@/lib/photography";
import { formatRollTime, rollMonthInputValue } from "@/lib/photography-format";
import {
  captionFrameAction,
  coverFrameAction,
  createRollAction,
  deleteFrameAction,
  deleteRollAction,
  moveFrameAction,
  publishRollAction,
  updateRollAction,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Photography · Control room",
};

export default async function PhotographyControlPage() {
  const rolls = await listAllRolls().catch(() => []);
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <main className="admin-page admin-rolls">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">
            <Link href="/controlroom">Control room</Link> · darkroom
          </p>
          <h1>Photography</h1>
          <p className="admin-private">
            A roll is one story in 1–{ROLL_MAX_FRAMES} frames. Drafts are only
            visible to you; the public index shows published rolls with at
            least one frame, newest year first. The first frame you upload
            becomes the hover cover until you pick another.
          </p>
        </div>
        <Link href="/photography">View the index →</Link>
      </header>

      <section className="admin-section" id="new-roll">
        <h2>Load a new roll</h2>
        <form className="admin-edit-form admin-roll-form" action={createRollAction}>
          <label>
            Title
            <input
              name="title"
              required
              maxLength={120}
              placeholder="the sunset that would not end"
            />
          </label>
          <label>
            Time (shows as 9月 2026)
            <input name="when" type="month" defaultValue={thisMonth} />
          </label>
          <label>
            Note — the first line is the “P.” photograph column in the index
            <textarea
              name="note"
              maxLength={2000}
              rows={3}
              placeholder="First line shows in the index. The rest sits above the frames."
            />
          </label>
          <button type="submit">Create draft roll</button>
        </form>
      </section>

      {rolls.length === 0 ? (
        <p className="admin-muted">No rolls yet. Load one above.</p>
      ) : null}

      {rolls.map((roll) => (
        <section className="admin-section admin-roll" key={roll.id} id={roll.id}>
          <div className="admin-section-heading">
            <div>
              <h2>
                {roll.title}
                <span
                  className={`admin-place-status is-${
                    roll.published ? "published" : "draft"
                  }`}
                >
                  {roll.published ? "published" : "draft"}
                </span>
              </h2>
              <p className="admin-private">
                {formatRollTime(roll) || "no date"} · {roll.frameCount} /{" "}
                {ROLL_MAX_FRAMES} frames ·{" "}
                <Link href={`/photography/${roll.slug}`}>
                  /photography/{roll.slug}
                </Link>
              </p>
            </div>
            <div className="admin-roll-actions">
              <form action={publishRollAction}>
                <input type="hidden" name="id" value={roll.id} />
                <input
                  type="hidden"
                  name="published"
                  value={roll.published ? "false" : "true"}
                />
                <button type="submit" disabled={!roll.published && !roll.frameCount}>
                  {roll.published ? "Unpublish" : "Publish"}
                </button>
              </form>
              <form action={deleteRollAction}>
                <input type="hidden" name="id" value={roll.id} />
                <ConfirmButton
                  className="admin-danger"
                  message={`Delete “${roll.title}” and all ${roll.frameCount} of its frames? This cannot be undone.`}
                >
                  Delete roll
                </ConfirmButton>
              </form>
            </div>
          </div>

          <details className="admin-roll-details">
            <summary>Edit title, time, note, slug</summary>
            <form className="admin-edit-form admin-roll-form" action={updateRollAction}>
              <input type="hidden" name="id" value={roll.id} />
              <label>
                Title
                <input name="title" required maxLength={120} defaultValue={roll.title} />
              </label>
              <label>
                Time (shows as 9月 2026)
                <input
                  name="when"
                  type="month"
                  defaultValue={rollMonthInputValue(roll)}
                />
              </label>
              <label>
                Slug
                <input name="slug" maxLength={80} defaultValue={roll.slug} />
              </label>
              <label>
                Note
                <textarea name="note" maxLength={2000} rows={4} defaultValue={roll.note} />
              </label>
              <button type="submit">Save roll</button>
            </form>
          </details>

          <RollUploader
            rollId={roll.id}
            remaining={Math.max(0, ROLL_MAX_FRAMES - roll.frameCount)}
          />

          {roll.frames.length ? (
            <ol className="admin-frames">
              {roll.frames.map((frame, position) => {
                const isCover = roll.cover?.id === frame.id;
                return (
                  <li className="admin-frame" key={frame.id}>
                    <div className="admin-frame-image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={frame.url} alt={frame.caption || `Frame ${position + 1}`} loading="lazy" />
                      {isCover ? <span className="admin-frame-cover">cover</span> : null}
                    </div>
                    <div className="admin-frame-body">
                      <p className="admin-muted">
                        {String(position + 1).padStart(2, "0")}
                        {frame.width && frame.height
                          ? ` · ${frame.width}×${frame.height}`
                          : ""}
                      </p>
                      <form className="admin-edit-form" action={captionFrameAction}>
                        <input type="hidden" name="id" value={frame.id} />
                        <input type="hidden" name="rollId" value={roll.id} />
                        <label>
                          Caption
                          <textarea
                            name="caption"
                            rows={2}
                            maxLength={600}
                            defaultValue={frame.caption}
                            placeholder="optional"
                          />
                        </label>
                        <button type="submit">Save caption</button>
                      </form>
                      <div className="admin-frame-actions">
                        <form action={moveFrameAction}>
                          <input type="hidden" name="id" value={frame.id} />
                          <input type="hidden" name="rollId" value={roll.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button type="submit" disabled={position === 0} aria-label="Move earlier">
                            ↑
                          </button>
                        </form>
                        <form action={moveFrameAction}>
                          <input type="hidden" name="id" value={frame.id} />
                          <input type="hidden" name="rollId" value={roll.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button
                            type="submit"
                            disabled={position === roll.frames.length - 1}
                            aria-label="Move later"
                          >
                            ↓
                          </button>
                        </form>
                        {!isCover ? (
                          <form action={coverFrameAction}>
                            <input type="hidden" name="id" value={frame.id} />
                            <input type="hidden" name="rollId" value={roll.id} />
                            <button type="submit">Use as cover</button>
                          </form>
                        ) : null}
                        <form action={deleteFrameAction}>
                          <input type="hidden" name="id" value={frame.id} />
                          <input type="hidden" name="rollId" value={roll.id} />
                          <ConfirmButton
                            className="admin-danger"
                            message="Delete this frame?"
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="admin-muted">No frames yet.</p>
          )}
        </section>
      ))}
    </main>
  );
}
