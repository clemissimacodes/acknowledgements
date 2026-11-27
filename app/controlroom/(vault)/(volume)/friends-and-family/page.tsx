import Link from "next/link";
import { BirthdaySelect } from "@/components/friends/BirthdaySelect";
import { CollectionSelect } from "@/components/friends/CollectionSelect";
import { FriendBrowser } from "@/components/friends/FriendBrowser";
import { FriendForm } from "@/components/friends/FriendForm";
import { RosterAutosave } from "@/components/friends/RosterAutosave";
import { FRIEND_ERAS, RELATIONSHIPS, SHOP_HANDLE } from "@/lib/friend-types";
import { listFriends } from "@/lib/friends";
import {
  getShopAnalytics,
  type ShopActivityItem,
  type ShopPeriodTotals,
} from "@/lib/good-company-analytics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Friends & Family · Control room",
  robots: { index: false, follow: false },
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function activityLine(item: ShopActivityItem) {
  const who = item.nickname || item.friendSlug;
  switch (item.event) {
    case "shop_view":
      return `browsed ${item.path}`;
    case "product_view":
      return who ? `viewed ${who}` : "viewed a product";
    case "add_to_bag":
      return who ? `bagged ${who}` : "added to bag";
    case "remove_from_bag":
      return who ? `removed ${who}` : "removed from bag";
    case "checkout": {
      const count =
        item.meta && typeof item.meta.itemCount === "number" ? item.meta.itemCount : null;
      if (who && count && count > 1) return `checked out ${who} (+${count - 1})`;
      if (who) return `checked out ${who}`;
      return count ? `checked out ${count}` : "checked out";
    }
    default:
      return item.event;
  }
}

function TotalsStrip({ label, totals }: { label: string; totals: ShopPeriodTotals }) {
  return (
    <p className="admin-muted" aria-label={`${label} shop analytics`}>
      <strong>{totals.shopViews}</strong> shop · <strong>{totals.productViews}</strong> products ·{" "}
      <strong>{totals.bagAdds}</strong> bagged · <strong>{totals.checkouts}</strong> checkouts ·{" "}
      <strong>{totals.uniqueVisitors}</strong> visitors
      <span> · {label}</span>
    </p>
  );
}

export default async function FriendsControlPage() {
  const [friends, analytics] = await Promise.all([
    listFriends({ all: true }).catch(() => []),
    getShopAnalytics({ days: 30 }).catch(() => null),
  ]);
  const visible = friends.filter((f) => f.visible).length;

  return (
    <main className="admin-page admin-page-studio">
      <section className="admin-section admin-section-studio">
        <div className="admin-section-heading admin-studio-heading">
          <h2>Friends & Family</h2>
          <span className="admin-muted">
            {friends.length} listed · {visible} visible · everything saves on its own ·{" "}
            <Link href={`/collections/${SHOP_HANDLE}`}>open the shop</Link>
          </span>
        </div>
        {friends.length ? <FriendBrowser friends={friends} /> : <p className="admin-muted">No one yet.</p>}
      </section>

      <section className="admin-section" id="shop-analytics">
        <div className="admin-section-heading">
          <h2>Shop analytics</h2>
          <span className="admin-muted">
            Last 30 days · privacy-safe hashed IP · admin traffic skipped · 90-day retention
          </span>
        </div>
        {analytics ? (
          <>
            <p className="admin-muted" style={{ marginTop: 0 }}>
              7-day pulse
            </p>
            <TotalsStrip label="7d" totals={analytics.totals7} />
            <p className="admin-muted" style={{ marginTop: 0 }}>
              30-day pulse
            </p>
            <TotalsStrip label="30d" totals={analytics.totals30} />

            <h3 className="admin-muted" style={{ fontWeight: 500, letterSpacing: "0.04em" }}>
              Most popular
            </h3>
            {analytics.topFriends.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Friend</th>
                      <th>Views</th>
                      <th>Bag adds</th>
                      <th>Checkouts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topFriends.map((row, index) => (
                      <tr key={row.friendSlug}>
                        <td>{index + 1}</td>
                        <td>
                          <Link href={`/products/${row.friendSlug}`}>
                            {row.nickname || row.friendSlug}
                          </Link>
                          {row.nickname ? (
                            <span className="admin-muted"> · {row.friendSlug}</span>
                          ) : null}
                        </td>
                        <td>{row.views}</td>
                        <td>{row.bagAdds}</td>
                        <td>{row.checkouts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-muted">No product activity yet.</p>
            )}

            <h3
              className="admin-muted"
              style={{ fontWeight: 500, letterSpacing: "0.04em", marginTop: "2rem" }}
            >
              Recent activity
            </h3>
            {analytics.recent.length ? (
              <ul className="admin-muted" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {analytics.recent.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: "1rem",
                      justifyContent: "space-between",
                      padding: "0.45rem 0",
                      borderBottom: "1px solid rgba(28, 35, 30, 0.1)",
                    }}
                  >
                    <span>{activityLine(item)}</span>
                    <time dateTime={item.createdAt} style={{ whiteSpace: "nowrap", opacity: 0.72 }}>
                      {formatWhen(item.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-muted">Quiet so far.</p>
            )}
          </>
        ) : (
          <p className="admin-muted">Analytics unavailable right now.</p>
        )}
      </section>

      <section className="admin-section">
        <details className="admin-ask">
          <summary>Everyone at once (table)</summary>
        <p className="admin-muted">
          Birthday (the price), collection (the season you met), era, relationship, poem and visibility for everyone in
          one scroll. Highlighted rows still need a birthday or a collection.
        </p>
        <RosterAutosave>
          <table className="admin-roster">
            <thead>
              <tr>
                <th>Name</th>
                <th>Birthday</th>
                <th>Collection</th>
                <th>Era</th>
                <th>Relationship</th>
                <th>Poem</th>
                <th>Hero</th>
                <th>Visible</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {friends.map((f) => (
                <tr key={f.id} data-id={f.id} data-name={f.nickname} className={!f.collection || !f.birthday ? "admin-roster-todo" : undefined}>
                  <td>
                    <a href={`#${f.id}`}>{f.nickname}</a>
                    {f.productName ? <small> {f.productName}</small> : null}
                  </td>
                  <td>
                    <BirthdaySelect name={`birthday-${f.id}`} defaultValue={f.birthday} />
                  </td>
                  <td>
                    <CollectionSelect name={`collection-${f.id}`} defaultValue={f.collection} />
                  </td>
                  <td>
                    <select name={`era-${f.id}`} defaultValue={f.era}>
                      {FRIEND_ERAS.map((era) => (
                        <option key={era.handle} value={era.handle}>
                          {era.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input name={`relationship-${f.id}`} list="ff-relationships-roster" defaultValue={f.relationship} />
                  </td>
                  <td className="admin-roster-poem">
                    <input name={`poemTitle-${f.id}`} defaultValue={f.poemTitle} placeholder="Title" />
                    <input name={`poemPoet-${f.id}`} defaultValue={f.poemPoet} placeholder="Poet" />
                    <input name={`poemUrl-${f.id}`} type="url" defaultValue={f.poemUrl} placeholder="poetryfoundation.org/…" />
                  </td>
                  <td>{f.heroUrl ? "yes" : "—"}</td>
                  <td>
                    <input type="checkbox" name={`visible-${f.id}`} defaultChecked={f.visible} />
                  </td>
                  <td className="admin-roster-notes">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="ff-relationships-roster">
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </RosterAutosave>
        </details>
      </section>

      <section className="admin-section">
        <details className="admin-ask">
          <summary>Add a friend</summary>
          <FriendForm />
        </details>
      </section>
    </main>
  );
}
