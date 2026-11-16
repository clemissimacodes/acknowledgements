import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Notifications } from "@/components/admin/Notifications";
import { ShortcutTokenManager } from "@/components/admin/ShortcutTokenManager";
import { getAdminData, isAdminUser } from "@/lib/admin";
import { getNotifications } from "@/lib/notifications";
import { visitorHash } from "@/lib/recording-visitor";
import { getSecretsAttemptReport } from "@/lib/secrets-attempts";
import { getTrackerAdminData } from "@/lib/tracker";
import { getPendingAskCount } from "@/lib/ask";
import {
  changePlaceStatus,
  clearSecretsAttemptLog,
  emergencyGoDark,
  removeAllVisits,
  removePlace,
  removeRadar,
  removeRecord,
  revokeShortcutToken,
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

const vaultPages = [
  { title: "Leave a Note replies", href: "/controlroom/ask" },
  { title: "Voice Memos", href: "/controlroom/voice-memos" },
  { title: "Clemi Radar", href: "/controlroom/radar" },
  { title: "Clemi Store", href: "/controlroom/shop" },
  { title: "Sunday Posties", href: "/controlroom/sunday-posties" },
  { title: "Acknowledgements", href: "/controlroom/acknowledgements" },
] as const;

export default async function AdminPage() {
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

  const [
    data,
    tracker,
    breakIns,
    pendingAsks,
    news,
  ] =
    await Promise.all([
      getAdminData(),
      getTrackerAdminData(),
      getSecretsAttemptReport(),
      getPendingAskCount().catch(() => 0),
      // Her own hearts are left out of the feed by her visitor cookie.
      visitorHash()
        .then(getNotifications)
        .catch((error) => {
          console.error("Notifications could not be loaded.", error);
          return null;
        }),
    ]);
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

      <Notifications data={news} />

      <nav className="admin-vault" aria-label="Vault">
        <p className="admin-eyebrow">the vault · formerly secrets</p>
        <ul>
          {vaultPages.map((page) => (
            <li key={page.href}>
              <Link href={page.href}>
                {page.title}
                {page.href === "/controlroom/ask" && pendingAsks > 0
                  ? ` (${pendingAsks} waiting)`
                  : ""}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="admin-section admin-break-ins" id="secrets-attempts">
        <div className="admin-section-heading">
          <div>
            <h2>Secrets break-in log</h2>
            <p className="admin-private">
              Every guess at the <Link href="/secrets">/secrets</Link> door,
              exactly as typed. Guessers are matched by a guest cookie and a
              hashed IP; a Clerk identity is shown when one was signed in.
            </p>
          </div>
          {breakIns.total > 0 ? (
            <form action={clearSecretsAttemptLog}>
              <ConfirmButton
                className="admin-danger"
                message="Permanently delete every break-in attempt record?"
              >
                Clear log
              </ConfirmButton>
            </form>
          ) : null}
        </div>
        <div className="admin-break-in-stats">
          <span>
            <strong>{breakIns.total}</strong> attempts
          </span>
          <span>
            <strong>{breakIns.last24h}</strong> in 24h
          </span>
          <span>
            <strong>{breakIns.guessers.length}</strong> guessers
          </span>
          <span>
            <strong>{breakIns.cracked}</strong> cracked
          </span>
          <span>
            <strong>{breakIns.globalFailuresThisHour}</strong> /{" "}
            {breakIns.globalFailuresPerHourCap} global wrong-guess cap this hour
          </span>
        </div>
        {breakIns.guessers.length ? (
          <div className="admin-cards admin-cards-small">
            {breakIns.guessers.map((guesser) => (
              <article className="admin-card" key={guesser.handle}>
                <div className="admin-card-head">
                  <h3>{guesser.clerkEmail ?? guesser.handle}</h3>
                  <span
                    className={`admin-place-status is-${
                      guesser.cracked ? "published" : "draft"
                    }`}
                  >
                    {guesser.cracked ? "cracked" : `${guesser.wrong} wrong`}
                  </span>
                </div>
                <p className="admin-record-status">
                  {[guesser.city, guesser.country].filter(Boolean).join(", ") ||
                    "somewhere"}{" "}
                  · {guesser.device} · {guesser.attempts} tries · last{" "}
                  {date(guesser.lastSeen)}
                </p>
                <p>
                  last guess: <code className="admin-guess">{guesser.lastGuess}</code>
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-muted">Nobody has knocked yet.</p>
        )}
        {breakIns.attempts.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Guesser</th>
                  <th>Where</th>
                  <th>Device</th>
                  <th>Guess</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {breakIns.attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{date(attempt.createdAt)}</td>
                    <td>
                      {attempt.clerkEmail ? (
                        <>
                          {attempt.clerkEmail}
                          <br />
                        </>
                      ) : null}
                      <small>
                        guest-{attempt.guestId.slice(0, 8)}
                        {attempt.ipHash ? ` · ip-${attempt.ipHash.slice(0, 8)}` : ""}
                      </small>
                    </td>
                    <td>
                      {[attempt.city, attempt.country].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td>{attempt.device}</td>
                    <td>
                      <code className="admin-guess">{attempt.guess}</code>
                    </td>
                    <td>
                      <span
                        className={`admin-place-status is-${
                          attempt.outcome === "cracked"
                            ? "published"
                            : attempt.outcome === "locked"
                              ? "rejected"
                              : "draft"
                        }`}
                      >
                        {attempt.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

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
            <Link href="/controlroom/radar">View radar</Link>
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

      <nav className="admin-counts" aria-label="Database counts">
        <a href="#posties"><strong>{data.posties.length}</strong> Posties</a>
        <a href="#wishes"><strong>{data.wishes.length}</strong> wishes</a>
        <a href="#secrets-attempts">
          <strong>{breakIns.total}</strong> break-in attempts
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

      <section className="admin-section" id="introductions" hidden>
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
