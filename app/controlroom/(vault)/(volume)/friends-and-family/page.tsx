import Link from "next/link";
import { clearFriendImageForm, deleteFriendForm, toggleVisibleForm } from "@/app/(shop)/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { FriendForm } from "@/components/friends/FriendForm";
import { ImageUploader } from "@/components/friends/ImageUploader";
import { SHOP_HANDLE, eraLabel, friendPrice, type Friend } from "@/lib/friend-types";
import { listFriends } from "@/lib/friends";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Friends & Family · Control room",
  robots: { index: false, follow: false },
};

function FriendCard({ friend, all }: { friend: Friend; all: Friend[] }) {
  return (
    <details className="admin-ask admin-friend" id={friend.id}>
      <summary>
        <span className="admin-friend-thumb">
          {friend.heroUrl ? <img src={friend.heroUrl} alt="" /> : <span />}
        </span>
        <strong>{friend.nickname}</strong>
        <span className="admin-muted">
          $ {friendPrice(friend.metOn)} · {eraLabel(friend.era)} · {friend.visible ? "visible" : "hidden"}
          {" · "}
          <Link href={`/products/${friend.slug}`}>page</Link>
        </span>
      </summary>

      <div className="admin-friend-images">
        <div>
          <p className="admin-muted">Hero (cutout on cream)</p>
          {friend.heroUrl ? <img src={friend.heroUrl} alt="" /> : <p className="admin-muted">None yet</p>}
          <ImageUploader id={friend.id} which="hero" label={friend.heroUrl ? "Replace hero" : "Upload hero"} />
          {friend.heroUrl ? (
            <form action={clearFriendImageForm}>
              <input type="hidden" name="id" value={friend.id} />
              <input type="hidden" name="which" value="hero" />
              <button type="submit">Remove</button>
            </form>
          ) : null}
        </div>
        <div>
          <p className="admin-muted">Second image (object / candid; shows on hover)</p>
          {friend.altUrl ? <img src={friend.altUrl} alt="" /> : <p className="admin-muted">None yet</p>}
          <ImageUploader id={friend.id} which="alt" label={friend.altUrl ? "Replace second" : "Upload second"} />
          {friend.altUrl ? (
            <form action={clearFriendImageForm}>
              <input type="hidden" name="id" value={friend.id} />
              <input type="hidden" name="which" value="alt" />
              <button type="submit">Remove</button>
            </form>
          ) : null}
        </div>
      </div>

      <FriendForm friend={friend} all={all} />

      <div className="admin-roll-actions">
        <form action={toggleVisibleForm}>
          <input type="hidden" name="id" value={friend.id} />
          <input type="hidden" name="visible" value={friend.visible ? "false" : "true"} />
          <button type="submit">{friend.visible ? "Hide from shop" : "Show in shop"}</button>
        </form>
        <form action={deleteFriendForm}>
          <input type="hidden" name="id" value={friend.id} />
          <ConfirmButton className="admin-danger" message={`Delete ${friend.nickname} and their photos? This cannot be undone.`}>
            Delete
          </ConfirmButton>
        </form>
      </div>
    </details>
  );
}

export default async function FriendsControlPage() {
  const friends = await listFriends({ all: true }).catch(() => []);
  const visible = friends.filter((f) => f.visible).length;

  return (
    <main className="admin-page">
      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Friends & Family</h2>
          <Link href={`/collections/${SHOP_HANDLE}`}>Open the shop</Link>
        </div>
        <p className="admin-muted">
          {friends.length} listed · {visible} visible. Price is the date you met (Sep 15 → $915). Hero images should be
          cutouts on transparent or cream backgrounds, roughly 4:5.
        </p>
      </section>

      <section className="admin-section">
        <h2>Add a friend</h2>
        <FriendForm all={friends} />
      </section>

      <section className="admin-section">
        <h2>Listings</h2>
        {friends.length ? friends.map((friend) => <FriendCard key={friend.id} friend={friend} all={friends} />) : (
          <p className="admin-muted">No one yet.</p>
        )}
      </section>
    </main>
  );
}
