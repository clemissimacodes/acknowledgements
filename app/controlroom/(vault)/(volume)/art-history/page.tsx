import Link from "next/link";
import { ArtImageUploader } from "@/components/admin/ArtImageUploader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { listAllPieces, type ArtPiece } from "@/lib/art-history";
import {
  createPieceAction,
  deletePieceAction,
  publishPieceAction,
  removeImageAction,
  updatePieceAction,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Art History · Control room",
};

function PieceFields({ piece }: { piece?: ArtPiece }) {
  return (
    <>
      <label>
        Artist
        <input
          name="artist"
          required
          maxLength={120}
          defaultValue={piece?.artist ?? ""}
          placeholder="Johannes Vermeer"
        />
      </label>
      <label>
        Work
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={piece?.title ?? ""}
          placeholder="Girl with a Pearl Earring"
        />
      </label>
      <label>
        Time (shown as written; sorted by the year in it)
        <input
          name="time"
          maxLength={60}
          defaultValue={piece?.time ?? ""}
          placeholder="c. 1665"
        />
      </label>
      <label>
        Where it lives, optional
        <input
          name="place"
          maxLength={160}
          defaultValue={piece?.place ?? ""}
          placeholder="Mauritshuis, The Hague"
        />
      </label>
      <label>
        Things i love about it — one per line
        <textarea
          name="loves"
          rows={6}
          maxLength={12000}
          defaultValue={piece?.loves.join("\n") ?? ""}
          placeholder={"the single drop of light on the pearl\nthe turban that should not work\nhow she is mid-turn, about to say something"}
        />
      </label>
      <label>
        Note, optional (sits between the image and the loves)
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={piece?.note ?? ""}
        />
      </label>
      {piece ? (
        <label>
          Slug
          <input name="slug" maxLength={80} defaultValue={piece.slug} />
        </label>
      ) : null}
    </>
  );
}

export default async function ArtHistoryControlPage() {
  const pieces = await listAllPieces().catch(() => []);

  return (
    <main className="admin-page admin-rolls">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">
            <Link href="/controlroom">Control room</Link> · gallery
          </p>
          <h1>Art History</h1>
          <p className="admin-private">
            Favourite pieces and what you love about each. Drafts are only
            visible to you; the public index shows published pieces with an
            image, oldest first. Add an image by uploading a file or pasting
            a direct image URL — a copy is kept in your own storage either way.
          </p>
        </div>
        <Link href="/art-history">View the gallery →</Link>
      </header>

      <section className="admin-section" id="new-piece">
        <h2>Hang a new piece</h2>
        <form className="admin-edit-form admin-roll-form" action={createPieceAction}>
          <PieceFields />
          <button type="submit">Create draft piece</button>
        </form>
      </section>

      {pieces.length === 0 ? (
        <p className="admin-muted">Nothing on the walls yet.</p>
      ) : null}

      {pieces.map((piece) => (
        <section className="admin-section admin-roll" key={piece.id} id={piece.id}>
          <div className="admin-section-heading">
            <div>
              <h2>
                {piece.title}
                <span
                  className={`admin-place-status is-${
                    piece.published ? "published" : "draft"
                  }`}
                >
                  {piece.published ? "published" : "draft"}
                </span>
              </h2>
              <p className="admin-private">
                {piece.artist}
                {piece.time ? ` · ${piece.time}` : ""} ·{" "}
                <Link href={`/art-history/${piece.slug}`}>
                  /art-history/{piece.slug}
                </Link>
              </p>
            </div>
            <div className="admin-roll-actions">
              <form action={publishPieceAction}>
                <input type="hidden" name="id" value={piece.id} />
                <input
                  type="hidden"
                  name="published"
                  value={piece.published ? "false" : "true"}
                />
                <button type="submit" disabled={!piece.published && !piece.image}>
                  {piece.published ? "Unpublish" : "Publish"}
                </button>
              </form>
              <form action={deletePieceAction}>
                <input type="hidden" name="id" value={piece.id} />
                <ConfirmButton
                  className="admin-danger"
                  message={`Delete “${piece.title}”? This cannot be undone.`}
                >
                  Delete piece
                </ConfirmButton>
              </form>
            </div>
          </div>

          <div className="admin-art-piece">
            <div className="admin-art-image">
              {piece.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={piece.image.url} alt={piece.title} loading="lazy" />
                  <p className="admin-muted">
                    {piece.image.width && piece.image.height
                      ? `${piece.image.width}×${piece.image.height}`
                      : "size unknown"}
                  </p>
                  <form action={removeImageAction}>
                    <input type="hidden" name="id" value={piece.id} />
                    <ConfirmButton
                      className="admin-danger"
                      message="Remove this image? The piece will be unpublished until it has one."
                    >
                      Remove image
                    </ConfirmButton>
                  </form>
                </>
              ) : (
                <p className="admin-muted">No image yet.</p>
              )}
              <ArtImageUploader pieceId={piece.id} hasImage={Boolean(piece.image)} />
            </div>

            <form className="admin-edit-form admin-roll-form" action={updatePieceAction}>
              <input type="hidden" name="id" value={piece.id} />
              <PieceFields piece={piece} />
              <button type="submit">Save piece</button>
            </form>
          </div>
        </section>
      ))}
    </main>
  );
}
