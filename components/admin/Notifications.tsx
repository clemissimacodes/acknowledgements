import Link from "next/link";
import { markNotificationsAsSeen } from "@/app/admin/actions";
import type {
  CounterDelta,
  NotificationItem,
  Notifications as NotificationsData,
} from "@/lib/notifications";

const FEED_FOLD = 25;
const EARLIER_LIMIT = 60;
const DELTA_LIMIT = 5;

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function ago(from: string, to: string) {
  const minutes = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function Go({ href, children }: { href: string; children: React.ReactNode }) {
  return href.startsWith("#") ? (
    <a href={href}>{children}</a>
  ) : (
    <Link href={href}>{children}</Link>
  );
}

function Item({ item }: { item: NotificationItem }) {
  return (
    <li className="admin-news-item">
      <p className="admin-news-meta">
        <span>{item.label}</span>
        <time dateTime={item.at}>{when.format(new Date(item.at))}</time>
      </p>
      <p className="admin-news-text">{item.text}</p>
      {item.quote ? <blockquote>{item.quote}</blockquote> : null}
      {item.audioUrl ? (
        <audio controls preload="none" src={item.audioUrl} />
      ) : null}
      <Go href={item.href}>{item.action} →</Go>
    </li>
  );
}

function Deltas({
  total,
  one,
  many,
  items,
}: {
  total: number;
  one: string;
  many: string;
  items: CounterDelta[];
}) {
  const shown = items.slice(0, DELTA_LIMIT);
  const rest = items.length - shown.length;
  return (
    <li>
      <strong>{total}</strong> {total === 1 ? one : many}
      {": "}
      {shown.map((item, index) => (
        <span key={item.href}>
          {index ? ", " : ""}
          <Go href={item.href}>{item.title}</Go> ({item.count})
        </span>
      ))}
      {rest > 0 ? `, and ${rest} more` : ""}
    </li>
  );
}

export function Notifications({ data }: { data: NotificationsData | null }) {
  if (!data) {
    return (
      <section className="admin-news" aria-labelledby="news-title">
        <h2 id="news-title">Since you last checked</h2>
        <p className="admin-muted">
          The notifications could not be loaded just now. Everything below still
          works.
        </p>
      </section>
    );
  }

  const plays = data.plays.reduce((sum, item) => sum + item.count, 0);
  const reads = data.reads.reduce((sum, item) => sum + item.count, 0);
  const hasQuiet =
    data.traffic.visits > 0 || plays > 0 || reads > 0 || data.opens > 0;
  const hasNew = data.fresh.length > 0 || hasQuiet;
  const top = data.fresh.slice(0, FEED_FOLD);
  const folded = data.fresh.slice(FEED_FOLD);
  const earlier = data.earlier.slice(0, EARLIER_LIMIT);

  return (
    <section className="admin-news" id="news" aria-labelledby="news-title">
      <div className="admin-news-head">
        <div>
          <h2 id="news-title">Since you last checked</h2>
          <p className="admin-muted">
            {data.firstVisit
              ? "First look, so this covers the last 7 days."
              : `Last marked as seen ${when.format(new Date(data.since))} PT, ${ago(
                  data.since,
                  data.through,
                )}.`}
          </p>
        </div>
        {hasNew ? (
          <form action={markNotificationsAsSeen}>
            <input type="hidden" name="through" value={data.through} />
            <input
              type="hidden"
              name="counters"
              value={JSON.stringify(data.snapshot)}
            />
            <button type="submit">Mark all as seen</button>
          </form>
        ) : null}
      </div>

      {data.waitingNotes > 0 ? (
        <p className="admin-news-waiting">
          <Link href="/controlroom/ask">
            {data.waitingNotes}{" "}
            {data.waitingNotes === 1 ? "note is" : "notes are"} waiting for a
            reply →
          </Link>
        </p>
      ) : null}

      {hasNew ? null : (
        <p className="admin-news-empty">Nothing new. You are all caught up.</p>
      )}

      {data.tallies.length ? (
        <ul className="admin-news-tallies">
          {data.tallies.map((tally) => (
            <li key={tally.group}>
              <Go href={tally.href}>
                <strong>
                  {tally.count}
                  {tally.capped ? "+" : ""}
                </strong>
                {tally.label}
              </Go>
            </li>
          ))}
        </ul>
      ) : null}

      {hasQuiet ? (
        <ul className="admin-news-quiet">
          {data.traffic.visits > 0 ? (
            <li>
              <strong>{data.traffic.visits}</strong>{" "}
              {data.traffic.visits === 1 ? "visit" : "visits"} from{" "}
              {data.traffic.visitors}{" "}
              {data.traffic.visitors === 1 ? "visitor" : "visitors"}
              {": "}
              {data.traffic.pages.map((page, index) => (
                <span key={page.path}>
                  {index ? ", " : ""}
                  {page.path} ({page.count})
                </span>
              ))}
              {" · "}
              <a href="#visits">all visits</a>
            </li>
          ) : null}
          {plays > 0 ? (
            <Deltas
              total={plays}
              one="memo play"
              many="memo plays"
              items={data.plays}
            />
          ) : null}
          {reads > 0 ? (
            <Deltas
              total={reads}
              one="poem read"
              many="poem reads"
              items={data.reads}
            />
          ) : null}
          {data.opens > 0 ? (
            <li>
              <strong>{data.opens}</strong>{" "}
              {data.opens === 1 ? "note page opened" : "note pages opened"}
            </li>
          ) : null}
        </ul>
      ) : null}

      {top.length ? (
        <ol className="admin-news-feed">
          {top.map((item) => (
            <Item key={item.key} item={item} />
          ))}
        </ol>
      ) : null}

      {folded.length ? (
        <details className="admin-news-more">
          <summary>Show {folded.length} more new</summary>
          <ol className="admin-news-feed">
            {folded.map((item) => (
              <Item key={item.key} item={item} />
            ))}
          </ol>
        </details>
      ) : null}

      {earlier.length ? (
        <details className="admin-news-more">
          <summary>
            Already seen, from the week before ({data.earlier.length})
          </summary>
          <ol className="admin-news-feed is-seen">
            {earlier.map((item) => (
              <Item key={item.key} item={item} />
            ))}
          </ol>
          {data.earlier.length > earlier.length ? (
            <p className="admin-muted">
              Showing the newest {earlier.length} of {data.earlier.length}.
            </p>
          ) : null}
        </details>
      ) : null}

      {data.failed.length ? (
        <p className="admin-muted">
          Could not check: {data.failed.join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
