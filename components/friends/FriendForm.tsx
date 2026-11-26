import { createFriendForm, updateFriendForm } from "@/app/(shop)/actions";
import {
  FRIEND_BADGES,
  FRIEND_ERAS,
  MET_HOW,
  type Friend,
  type FriendBadge,
} from "@/lib/friend-types";

type Props = { friend?: Friend; all: Friend[] };

export function FriendForm({ friend, all }: Props) {
  const colors = friend?.colors.map((c) => `${c.name}: ${c.hex}`).join("\n") ?? "";
  return (
    <form action={friend ? updateFriendForm : createFriendForm} className="admin-friend-form">
      {friend ? <input type="hidden" name="id" value={friend.id} /> : null}

      <label>
        Nickname
        <input name="nickname" defaultValue={friend?.nickname ?? ""} maxLength={60} required />
      </label>
      <label>
        Tagline <small>(optional, shows under the name on their page)</small>
        <input name="productName" defaultValue={friend?.productName ?? ""} maxLength={80} />
      </label>
      <label>
        Slug
        <input name="slug" defaultValue={friend?.slug ?? ""} maxLength={60} placeholder="auto from nickname" />
      </label>
      <label>
        Date we met <small>(price)</small>
        <input type="date" name="metOn" defaultValue={friend?.metOn ?? ""} required />
      </label>
      <label>
        Era
        <select name="era" defaultValue={friend?.era ?? "new-arrivals"}>
          {FRIEND_ERAS.map((era) => (
            <option key={era.handle} value={era.handle}>
              {era.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Badge
        <select name="badge" defaultValue={friend?.badge ?? "one-of-one"}>
          {(Object.keys(FRIEND_BADGES) as FriendBadge[]).map((key) => (
            <option key={key} value={key}>
              {FRIEND_BADGES[key] || "None"}
            </option>
          ))}
        </select>
      </label>
      <label>
        How we met
        <select name="metHow" defaultValue={friend?.metHow ?? ""}>
          <option value="">—</option>
          {MET_HOW.map((how) => (
            <option key={how} value={how}>
              {how}
            </option>
          ))}
        </select>
      </label>
      <label>
        Made in <small>(hometown)</small>
        <input name="hometown" defaultValue={friend?.hometown ?? ""} maxLength={80} />
      </label>
      <label>
        Relationship <small>(the one in stock)</small>
        <input name="relationship" defaultValue={friend?.relationship ?? ""} maxLength={40} placeholder="Best Friend" />
      </label>
      <label>
        Other fits <small>(sold out, comma-separated)</small>
        <input
          name="relationshipOptions"
          defaultValue={friend?.relationshipOptions.filter((o) => o !== friend.relationship).join(", ") ?? ""}
          placeholder="Roommate, Co-conspirator, Sister"
        />
      </label>
      <label className="admin-friend-wide">
        Made of <small>(one per line)</small>
        <textarea name="madeOf" rows={3} defaultValue={friend?.madeOf.join("\n") ?? ""} placeholder={"100% loyalty\nTrace amounts of chaos"} />
      </label>
      <label className="admin-friend-wide">
        Care instructions
        <textarea name="care" rows={3} defaultValue={friend?.care ?? ""} placeholder="Do not text before 10am. Feed regularly. Handle with jokes." />
      </label>
      <label className="admin-friend-wide">
        Description
        <textarea name="description" rows={6} defaultValue={friend?.description ?? ""} />
      </label>
      <label>
        Colors <small>(name: #hex, one per line)</small>
        <textarea name="colors" rows={3} defaultValue={colors} placeholder={"Washed olive: #7f8a63\nCream: #f1ead8"} />
      </label>
      <label>
        Pairs well with <small>(slugs, comma-separated)</small>
        <textarea
          name="pairsWith"
          rows={3}
          defaultValue={friend?.pairsWith.join(", ") ?? ""}
          placeholder={all
            .filter((f) => f.slug !== friend?.slug)
            .slice(0, 3)
            .map((f) => f.slug)
            .join(", ")}
        />
      </label>
      <label>
        Sort order
        <input type="number" name="sortOrder" defaultValue={friend?.sortOrder ?? 0} />
      </label>
      <label className="admin-friend-check">
        <input type="checkbox" name="visible" defaultChecked={friend?.visible ?? false} /> Visible in the shop
      </label>

      <div className="admin-roll-actions admin-friend-wide">
        <button type="submit">{friend ? "Save" : "Add friend"}</button>
      </div>
    </form>
  );
}
