import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { DeviceRadar } from "@/components/admin/DeviceRadar";
import { getAdminData, isAdminUser } from "@/lib/admin";
import {
  removeAllVisits,
  removeRadar,
  removeRecord,
  saveIntroductionRecord,
  savePostiesRecord,
  saveWishRecord,
  togglePostiesSent,
  updateRadar,
} from "./actions";

export const dynamic = "force-dynamic";

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

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

  const data = await getAdminData();
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
            Catch this device’s fuzzy location, or enter a neighborhood
            manually. It vanishes after 12 hours and replaces the prior status.
          </p>
        </div>
        <form action={updateRadar}>
          <label>
            City or neighborhood
            <input
              name="area"
              maxLength={80}
              required
              defaultValue={data.radar?.area ?? ""}
              placeholder="the Lower East Side"
            />
          </label>
          <label>
            Radar transmission
            <input
              name="note"
              maxLength={140}
              defaultValue={data.radar?.note ?? ""}
              placeholder="foraging for perfect citrus"
            />
          </label>
          <button type="submit">Transmit for 12 hours</button>
        </form>
        <DeviceRadar />
        {data.radar ? (
          <div className="admin-radar-live">
            <p>
              Live: <strong>{data.radar.area}</strong>
              {data.radar.note ? ` — ${data.radar.note}` : ""}
            </p>
            <p>Expires {date(data.radar.expiresAt)} PT.</p>
            <form action={removeRadar}>
              <button type="submit">Take Clemi off radar</button>
            </form>
            <Link href="/radar">View public radar</Link>
          </div>
        ) : (
          <p className="admin-muted">Clemi is currently off radar.</p>
        )}
      </section>

      <nav className="admin-counts" aria-label="Database counts">
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
