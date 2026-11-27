import Link from "next/link";
import type { ShopAnalytics as Analytics, ShopEvent } from "@/lib/good-company-analytics";

function when(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function label(event: ShopEvent, friendSlug: string | null, nicknameBySlug: Map<string, string>) {
  const who = friendSlug ? nicknameBySlug.get(friendSlug) ?? friendSlug : null;
  switch (event) {
    case "shop_view":
      return "browsed the shop";
    case "product_view":
      return who ? `viewed ${who}` : "viewed a friend";
    case "add_to_bag":
      return who ? `bagged ${who}` : "added to bag";
    case "remove_from_bag":
      return who ? `removed ${who}` : "removed from bag";
    case "checkout":
      return who ? `checked out ${who}` : "checked out";
    default:
      return event;
  }
}

type Props = {
  data: Analytics;
  nicknameBySlug: Map<string, string>;
};

export function ShopAnalyticsPanel({ data, nicknameBySlug }: Props) {
  const { totals, popular, recent, days } = data;

  return (
    <section className="admin-section" id="good-company-analytics">
      <div className="admin-section-heading">
        <h2>Good Company activity</h2>
        <span className="admin-muted">last {days} days · privacy-safe hashes only</span>
      </div>

      <p className="admin-gc-totals">
        <strong>{totals.uniqueVisitors}</strong> visitors ·{" "}
        <strong>{totals.shopViews}</strong> shop views ·{" "}
        <strong>{totals.productViews}</strong> product views ·{" "}
        <strong>{totals.bagAdds}</strong> bag adds ·{" "}
        <strong>{totals.checkouts}</strong> checkouts
      </p>

      <div className="admin-gc-grid">
        <div>
          <h3 className="admin-gc-subhead">Most popular</h3>
          {popular.length ? (
            <div className="admin-table-wrap">
              <table className="admin-roster admin-gc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Friend</th>
                    <th>Views</th>
                    <th>Bag</th>
                    <th>Checkouts</th>
                  </tr>
                </thead>
                <tbody>
                  {popular.map((row, index) => (
                    <tr key={row.slug}>
                      <td>{index + 1}</td>
                      <td>
                        <Link href={`/products/${row.slug}`}>{row.nickname}</Link>
                        {row.productName ? <small> {row.productName}</small> : null}
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
        </div>

        <div>
          <h3 className="admin-gc-subhead">Recent activity</h3>
          {recent.length ? (
            <ul className="admin-gc-feed">
              {recent.map((row) => (
                <li key={row.id}>
                  <span>{label(row.event, row.friendSlug, nicknameBySlug)}</span>
                  <em>
                    {[row.city, row.country].filter(Boolean).join(", ") || row.device}
                    {" · "}
                    {when(row.createdAt)}
                  </em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-muted">Quiet so far.</p>
          )}
        </div>
      </div>
    </section>
  );
}
