import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ShortcutTokenManager } from "@/components/admin/ShortcutTokenManager";
import { getAdminData, isAdminUser } from "@/lib/admin";
import { CIA_PROJECTS, getCiaAdminEntries, type CiaStatus } from "@/lib/cia";
import { getTrackerAdminData } from "@/lib/tracker";
import {
  changePlaceStatus,
  emergencyGoDark,
  moderateCiaRecord,
  removeAllVisits,
  removeCiaRecord,
  removePlace,
  removeRadar,
  removeRecord,
  revokeShortcutToken,
  saveCiaRecord,
  savePlace,
  saveIntroductionRecord,
  savePostiesRecord,
  saveWishRecord,
  togglePostiesSent,
} from "./actions";

export const dynamic = "force-dynamic";

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

const statusActions: Partial<Record<CiaStatus, Array<[CiaStatus, string]>>> = {
  draft: [
    ["approved", "Approve revision"],
    ["rejected", "Reject"],
  ],
  approved: [
    ["published", "Publish"],
    ["rejected", "Reject"],
  ],
  published: [
    ["corrected", "Mark corrected"],
    ["withdrawn", "Withdraw"],
  ],
  rejected: [["draft", "Return to draft"]],
  corrected: [["withdrawn", "Withdraw"]],
  withdrawn: [["draft", "Reopen as draft"]],
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ ciaProject?: string }>;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/controlroom/login");
  }

  if (!isAdminUser(user)) {
    return (
      <main className="admin-page admin-login">
        <p className="admin-eyebrow">private burrow</p>
        <h1>This is not your burrow.</h1>
        <p>This account is signed in, but it is not the configured owner.</p>
        <UserButton />
      </main>
    );
  }

  const [data, tracker, ciaEntries] = await Promise.all([
    getAdminData(),
    getTrackerAdminData(),
    getCiaAdminEntries(),
  ]);
  const ciaProject = (await searchParams)?.ciaProject;
  const visibleCiaEntries = CIA_PROJECTS.includes(
    ciaProject as (typeof CIA_PROJECTS)[number],
  )
    ? ciaEntries.filter((entry) => entry.project === ciaProject)
    : ciaEntries;
  const uniqueVisitors = new Set(
    data.visits.map((visit) => visit.ipHash).filter(Boolean),
  ).size;

  return (
    <main className="admin-page">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">private burrow</p>
          <h1>Clemi control room</h1>
        </div>
        <UserButton />
      </header>

      <section className="admin-radar" aria-labelledby="radar-control-title">
        <div>
          <h2 id="radar-control-title">Clemi Radar</h2>
          <p>
            An authenticated iPhone Shortcut sends coordinates for immediate
            city-only lookup. Raw coordinates are discarded; the signal expires
            after three hours.
          </p>
        </div>
        <ShortcutTokenManager />
        <div className="admin-cards admin-cards-small">
          {tracker.tokens.map((token) => (
            <article className="admin-card" key={token.id}>
              <div className="admin-card-head">
                <h3>{token.label}</h3>
                <span className={`admin-place-status is-${token.status}`}>
                  {token.status}
                </span>
              </div>
              <p>
                Created {date(token.createdAt)}
                {token.lastUsedAt ? ` · last used ${date(token.lastUsedAt)}` : ""}
              </p>
              {token.status === "active" ? (
                <form action={revokeShortcutToken}>
                  <input type="hidden" name="id" value={token.id} />
                  <button type="submit">Revoke token</button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
        {tracker.current ? (
          <div className="admin-radar-live">
            <p>
              Current city: <strong>{tracker.current.city}</strong>,{" "}
              {tracker.current.country}
            </p>
            <p>Signal checked {date(tracker.current.updatedAt)} PT.</p>
            <form action={removeRadar}>
              <button type="submit">Take Clemi off radar</button>
            </form>
            <Link href="/secrets/radar">View public radar</Link>
          </div>
        ) : (
          <p className="admin-muted">Clemi is currently off radar.</p>
        )}
        <form action={emergencyGoDark}>
          <ConfirmButton
            className="admin-danger"
            message="Clear the current city and revoke every active Shortcut token?"
          >
            Emergency go dark
          </ConfirmButton>
        </form>
      </section>

      <section className="admin-section" id="travel-places">
        <h2>Travel places</h2>
        <p className="admin-private">
          Inferred and manually added locations stay private drafts until a
          separate approval. The public map shows city and year only.
        </p>
        <details className="admin-add-place">
          <summary>Add a city yourself</summary>
          <form className="admin-edit-form" action={savePlace}>
            <label>
              City
              <input name="city" required />
            </label>
            <label>
              Country
              <input name="country" required />
            </label>
            <label>
              First year
              <input name="firstYear" type="number" min="1900" max="2100" required />
            </label>
            <label>
              Last year
              <input name="lastYear" type="number" min="1900" max="2100" required />
            </label>
            <label>
              Confidence
              <select name="confidence" defaultValue="high">
                <option value="high">High</option>
                <option value="ambiguous">Ambiguous</option>
              </select>
            </label>
            <input type="hidden" name="evidenceCategory" value="owner-added" />
            <button type="submit">Add private draft</button>
          </form>
        </details>
        <div className="admin-cards admin-travel-cards">
          {tracker.places.map((place) => (
            <article className="admin-card" key={place.id}>
              <div className="admin-card-head">
                <h3>{place.city}</h3>
                <span className={`admin-place-status is-${place.status}`}>
                  {place.status}
                </span>
              </div>
              <p>
                {place.country} ·{" "}
                {place.firstYear === place.lastYear
                  ? place.firstYear
                  : `${place.firstYear}–${place.lastYear}`}
              </p>
              <p className="admin-record-status">
                {place.confidence} confidence · {place.evidenceCategory}
              </p>
              <div className="admin-record-actions">
                {place.status !== "approved" ? (
                  <form action={changePlaceStatus}>
                    <input type="hidden" name="id" value={place.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button type="submit">Approve for map</button>
                  </form>
                ) : null}
                {place.status !== "rejected" ? (
                  <form action={changePlaceStatus}>
                    <input type="hidden" name="id" value={place.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button type="submit">Hide</button>
                  </form>
                ) : null}
                <details>
                  <summary>Edit</summary>
                  <form className="admin-edit-form" action={savePlace}>
                    <input type="hidden" name="id" value={place.id} />
                    <label>
                      City
                      <input name="city" defaultValue={place.city} required />
                    </label>
                    <label>
                      Country
                      <input
                        name="country"
                        defaultValue={place.country}
                        required
                      />
                    </label>
                    <label>
                      First year
                      <input
                        name="firstYear"
                        type="number"
                        defaultValue={place.firstYear}
                        required
                      />
                    </label>
                    <label>
                      Last year
                      <input
                        name="lastYear"
                        type="number"
                        defaultValue={place.lastYear}
                        required
                      />
                    </label>
                    <label>
                      Confidence
                      <select name="confidence" defaultValue={place.confidence}>
                        <option value="high">High</option>
                        <option value="ambiguous">Ambiguous</option>
                      </select>
                    </label>
                    <label>
                      Evidence category
                      <select
                        name="evidenceCategory"
                        defaultValue={place.evidenceCategory}
                      >
                        <option value="owner-added">Owner-added</option>
                        <option value="flight">Flight</option>
                        <option value="flight and reservation">
                          Flight and reservation
                        </option>
                      </select>
                    </label>
                    <button type="submit">Save</button>
                  </form>
                </details>
                <form action={removePlace}>
                  <input type="hidden" name="id" value={place.id} />
                  <ConfirmButton
                    className="admin-danger"
                    message={`Permanently delete ${place.city} from Clemi Tracker?`}
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </article>
          ))}
          {tracker.places.length === 0 ? (
            <p>No private travel drafts yet.</p>
          ) : null}
        </div>
      </section>

      <section className="admin-section" id="cia">
        <h2>CIA publication desk</h2>
        <p className="admin-private">
          Private drafts and discovery candidates stay here. Editing creates a
          new draft revision; approved and published revisions remain
          immutable.
        </p>
        <nav className="admin-cia-filters" aria-label="Filter CIA records">
          <Link href="/controlroom#cia">All</Link>
          {CIA_PROJECTS.map((project) => (
            <Link
              href={`/controlroom?ciaProject=${project}#cia`}
              key={project}
            >
              {project}
            </Link>
          ))}
        </nav>
        <details className="admin-add-place">
          <summary>Add sourced draft</summary>
          <form className="admin-edit-form admin-cia-form" action={saveCiaRecord}>
            <label>
              Project
              <select name="project" required>
                {CIA_PROJECTS.map((project) => (
                  <option value={project} key={project}>
                    {project}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input name="title" maxLength={180} required />
            </label>
            <label>
              Slug
              <input
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="lowercase-hyphenated"
                required
              />
            </label>
            <label>
              Neutral summary
              <textarea name="summary" maxLength={3000} required />
            </label>
            <label>
              Event or observation date
              <input name="occurredOn" type="date" />
            </label>
            <label>
              Confidence label
              <input name="confidence" defaultValue="unreviewed" required />
            </label>
            <label>
              Official or credible source URL
              <input name="sourceUrl" type="url" required />
            </label>
            <label>
              Source label
              <input name="sourceLabel" defaultValue="Original source" required />
            </label>
            <label>
              Publisher
              <input name="publisher" required />
            </label>
            <label>
              Source type
              <select name="sourceType" defaultValue="official">
                <option value="official">Official</option>
                <option value="credible-public">Credible public source</option>
                <option value="owner-authored">Owner-authored</option>
              </select>
            </label>
            <label>
              Project details (JSON object)
              <textarea name="metadata" defaultValue="{}" spellCheck={false} />
            </label>
            <label>
              Draft note
              <textarea name="moderationRationale" />
            </label>
            <button type="submit">Create private draft</button>
          </form>
        </details>
        <div className="admin-cards">
          {visibleCiaEntries.map((entry) => {
            const source = entry.sources[0];
            return (
              <article className="admin-card admin-cia-card" key={entry.id}>
                <div className="admin-card-head">
                  <h3>{entry.title}</h3>
                  <span className={`admin-place-status is-${entry.status}`}>
                    {entry.status}
                  </span>
                </div>
                <p className="admin-record-status">
                  {entry.project} · revision {entry.revisionNumber} ·{" "}
                  {entry.confidence}
                </p>
                <p>{entry.summary}</p>
                {source ? (
                  <p className="admin-cia-source">
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.label}
                    </a>{" "}
                    · {source.publisher} · retrieved{" "}
                    {source.retrievedAt.slice(0, 10)}
                  </p>
                ) : (
                  <p className="admin-private">Missing source — do not approve.</p>
                )}
                <div className="admin-record-actions">
                  {(statusActions[entry.status] ?? []).map(([status, label]) => (
                    <form action={moderateCiaRecord} key={status}>
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="project" value={entry.project} />
                      <input type="hidden" name="status" value={status} />
                      <label className="admin-cia-rationale">
                        Rationale
                        <input name="rationale" minLength={3} required />
                      </label>
                      <button type="submit">{label}</button>
                    </form>
                  ))}
                  {entry.status !== "approved" && entry.status !== "published" ? (
                    <details>
                      <summary>Create revised draft</summary>
                      <form
                        className="admin-edit-form admin-cia-form"
                        action={saveCiaRecord}
                      >
                      <input type="hidden" name="id" value={entry.id} />
                      <label>
                        Project
                        <select name="project" defaultValue={entry.project}>
                          {CIA_PROJECTS.map((project) => (
                            <option value={project} key={project}>
                              {project}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Title
                        <input name="title" defaultValue={entry.title} required />
                      </label>
                      <label>
                        Slug
                        <input name="slug" defaultValue={entry.slug} required />
                      </label>
                      <label>
                        Neutral summary
                        <textarea
                          name="summary"
                          defaultValue={entry.summary}
                          required
                        />
                      </label>
                      <label>
                        Event or observation date
                        <input
                          name="occurredOn"
                          type="date"
                          defaultValue={entry.occurredOn ?? ""}
                        />
                      </label>
                      <label>
                        Confidence
                        <input
                          name="confidence"
                          defaultValue={entry.confidence}
                          required
                        />
                      </label>
                      <label>
                        Source URL
                        <input
                          name="sourceUrl"
                          type="url"
                          defaultValue={source?.url ?? ""}
                          required
                        />
                      </label>
                      <label>
                        Source label
                        <input
                          name="sourceLabel"
                          defaultValue={source?.label ?? ""}
                          required
                        />
                      </label>
                      <label>
                        Publisher
                        <input
                          name="publisher"
                          defaultValue={source?.publisher ?? ""}
                          required
                        />
                      </label>
                      <input
                        type="hidden"
                        name="sourceType"
                        value={source?.sourceType ?? "official"}
                      />
                      <label>
                        Project details (JSON object)
                        <textarea
                          name="metadata"
                          defaultValue={JSON.stringify(entry.metadata, null, 2)}
                          spellCheck={false}
                        />
                      </label>
                      <label>
                        Revision rationale
                        <textarea name="moderationRationale" required />
                      </label>
                        <button type="submit">Save as new draft revision</button>
                      </form>
                    </details>
                  ) : null}
                  {entry.status === "draft" || entry.status === "rejected" ? (
                    <form action={removeCiaRecord}>
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="project" value={entry.project} />
                      <ConfirmButton
                        className="admin-danger"
                        message={`Permanently delete ${entry.title} and every revision?`}
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
          {visibleCiaEntries.length === 0 ? <p>No CIA records in this view.</p> : null}
        </div>
      </section>

      <nav className="admin-counts" aria-label="Database counts">
        <a href="#cia"><strong>{ciaEntries.length}</strong> CIA files</a>
        <a href="#posties"><strong>{data.posties.length}</strong> Posties</a>
        <a href="#wishes"><strong>{data.wishes.length}</strong> wishes</a>
        <a href="#introductions">
          <strong>{data.introductions.length}</strong> introductions
        </a>
        <a href="#visits">
          <strong>{data.visits.length}</strong> visits / {uniqueVisitors} visitors
        </a>
      </nav>

      <section className="admin-section" id="posties">
        <h2>Sunday Posties</h2>
        <p className="admin-private">
          Private: mailing addresses and social profiles are visible only here.
        </p>
        <div className="admin-cards">
          {data.posties.map((signup) => (
            <article className="admin-card" key={signup.id}>
              <div className="admin-card-head">
                <h3>{signup.name}</h3>
                <time dateTime={signup.createdAt}>{date(signup.createdAt)}</time>
              </div>
              <p className="admin-record-status">
                {signup.sentAt ? `Sent ${date(signup.sentAt)}` : "Waiting to be sent"}
              </p>
              <a href={signup.socialUrl} target="_blank" rel="noreferrer">
                {signup.platform}: {signup.socialUrl}
              </a>
              <address>{signup.mailingAddress}</address>
              <div className="admin-record-actions">
                <form action={togglePostiesSent}>
                  <input type="hidden" name="id" value={signup.id} />
                  <input
                    type="hidden"
                    name="sent"
                    value={signup.sentAt ? "true" : "false"}
                  />
                  <button type="submit">
                    {signup.sentAt ? "Mark unsent" : "Mark sent"}
                  </button>
                </form>
                <details>
                  <summary>Edit</summary>
                  <form className="admin-edit-form" action={savePostiesRecord}>
                    <input type="hidden" name="id" value={signup.id} />
                    <label>
                      Name
                      <input name="name" defaultValue={signup.name} required />
                    </label>
                    <label>
                      Platform
                      <select name="platform" defaultValue={signup.platform}>
                        <option value="instagram">Instagram</option>
                        <option value="x">X</option>
                      </select>
                    </label>
                    <label>
                      Social profile
                      <input
                        name="socialUrl"
                        type="url"
                        defaultValue={signup.socialUrl}
                        required
                      />
                    </label>
                    <label>
                      Mailing address
                      <textarea
                        name="mailingAddress"
                        defaultValue={signup.mailingAddress}
                        rows={5}
                        required
                      />
                    </label>
                    <button type="submit">Save changes</button>
                  </form>
                </details>
                <form action={removeRecord}>
                  <input type="hidden" name="kind" value="posties" />
                  <input type="hidden" name="id" value={signup.id} />
                  <ConfirmButton
                    className="admin-danger"
                    message={`Permanently delete ${signup.name}’s Posties signup and mailing address?`}
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </article>
          ))}
          {data.posties.length === 0 ? <p>No posties yet.</p> : null}
        </div>
      </section>

      <section className="admin-section" id="wishes">
        <h2>Dandelion wishes</h2>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Wish</th>
                <th>Location</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Received</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.wishes.map((wish) => (
                <tr key={wish.id}>
                  <td>{wish.body}</td>
                  <td>{wish.location ?? "—"}</td>
                  <td>{wish.gender ?? "—"}</td>
                  <td>{wish.age ?? "—"}</td>
                  <td>{date(wish.createdAt)}</td>
                  <td>
                    <details className="admin-row-manage">
                      <summary>Edit</summary>
                      <form className="admin-edit-form" action={saveWishRecord}>
                        <input type="hidden" name="id" value={wish.id} />
                        <label>
                          Wish
                          <textarea
                            name="body"
                            defaultValue={wish.body}
                            maxLength={100}
                            required
                          />
                        </label>
                        <label>
                          Location
                          <input
                            name="location"
                            defaultValue={wish.location ?? ""}
                          />
                        </label>
                        <label>
                          Gender
                          <input
                            name="gender"
                            defaultValue={wish.gender ?? ""}
                          />
                        </label>
                        <label>
                          Age
                          <input name="age" defaultValue={wish.age ?? ""} />
                        </label>
                        <button type="submit">Save</button>
                      </form>
                    </details>
                    <form action={removeRecord}>
                      <input type="hidden" name="kind" value="wish" />
                      <input type="hidden" name="id" value={wish.id} />
                      <ConfirmButton
                        className="admin-danger"
                        message="Permanently delete this dandelion wish?"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section" id="introductions">
        <h2>Tiny introductions</h2>
        <div className="admin-cards admin-cards-small">
          {data.introductions.map((introduction) => (
            <article className="admin-card" key={introduction.id}>
              <p>{introduction.tinyThing}</p>
              <time dateTime={introduction.createdAt}>
                {date(introduction.createdAt)}
              </time>
              <div className="admin-record-actions">
                <details>
                  <summary>Edit</summary>
                  <form
                    className="admin-edit-form"
                    action={saveIntroductionRecord}
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={introduction.id}
                    />
                    <label>
                      Tiny thing
                      <textarea
                        name="tinyThing"
                        defaultValue={introduction.tinyThing}
                        maxLength={400}
                        required
                      />
                    </label>
                    <button type="submit">Save</button>
                  </form>
                </details>
                <form action={removeRecord}>
                  <input type="hidden" name="kind" value="introduction" />
                  <input type="hidden" name="id" value={introduction.id} />
                  <ConfirmButton
                    className="admin-danger"
                    message="Permanently delete this tiny introduction?"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section" id="visits">
        <h2>Visits from the last 30 days</h2>
        <p className="admin-private">
          Privacy-safe: page, time, referring site, device, coarse
          city/country, and a one-way IP hash. Raw IP addresses are never stored.
        </p>
        {data.visits.length > 0 ? (
          <form className="admin-clear-visits" action={removeAllVisits}>
            <ConfirmButton
              className="admin-danger"
              message="Permanently delete every visitor analytics record?"
            >
              Clear all visit records
            </ConfirmButton>
          </form>
        ) : null}
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Page</th>
                <th>City / country</th>
                <th>Device</th>
                <th>Referrer</th>
                <th>Anonymous visitor</th>
                <th>Time</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.visits.map((visit) => (
                <tr key={visit.id}>
                  <td>{visit.path}</td>
                  <td>
                    {[visit.city, visit.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td>{visit.device}</td>
                  <td>{visit.referrerHost ?? "direct"}</td>
                  <td>{visit.ipHash?.slice(0, 12) ?? "unknown"}</td>
                  <td>{date(visit.createdAt)}</td>
                  <td>
                    <form action={removeRecord}>
                      <input type="hidden" name="kind" value="visit" />
                      <input type="hidden" name="id" value={visit.id} />
                      <ConfirmButton
                        className="admin-danger"
                        message="Permanently delete this visit record?"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
