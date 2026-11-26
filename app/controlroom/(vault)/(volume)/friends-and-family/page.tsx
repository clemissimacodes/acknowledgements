import Link from "next/link";
import { BirthdaySelect } from "@/components/friends/BirthdaySelect";
import { CollectionSelect } from "@/components/friends/CollectionSelect";
import { FriendBrowser } from "@/components/friends/FriendBrowser";
import { FriendForm } from "@/components/friends/FriendForm";
import { RosterAutosave } from "@/components/friends/RosterAutosave";
import { FRIEND_ERAS, RELATIONSHIPS, SHOP_HANDLE } from "@/lib/friend-types";
import { listFriends } from "@/lib/friends";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Friends & Family · Control room",
  robots: { index: false, follow: false },
};

export default async function FriendsControlPage() {
  const friends = await listFriends({ all: true }).catch(() => []);
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
