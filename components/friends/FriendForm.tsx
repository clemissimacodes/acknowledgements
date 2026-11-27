import { createFriendForm, updateFriendForm } from "@/app/(shop)/actions";
import { AutoSaveForm, type SaveStatus } from "@/components/admin/AutoSaveForm";
import { BirthdaySelect } from "@/components/friends/BirthdaySelect";
import { CollectionSelect } from "@/components/friends/CollectionSelect";
import { MadeOfPicker } from "@/components/friends/MadeOfPicker";
import { PoemFields } from "@/components/friends/PoemFields";
import {
  FRIEND_BADGES,
  FRIEND_ERAS,
  MET_HOW,
  RELATIONSHIPS,
  type Friend,
  type FriendBadge,
} from "@/lib/friend-types";

export const FORM_TABS = [
  { key: "details", label: "Details" },
  { key: "words", label: "Words" },
  { key: "poem", label: "Poem" },
  { key: "madeOf", label: "Made of" },
  { key: "photos", label: "Photos" },
] as const;
export type FormTab = (typeof FORM_TABS)[number]["key"];

type Props = {
  friend?: Friend;
  /* Edit mode: which section is showing. All sections stay mounted so every save carries every field. */
  tab?: FormTab;
  onStatus?: (status: SaveStatus) => void;
};

export function FriendForm({ friend, tab, onStatus }: Props) {
  const all = !tab;
  const show = (key: FormTab) => all || tab === key;

  const fields = (
    <>
      <section className="admin-ff-section" hidden={!show("details")}>
        {all ? <h4>Details</h4> : null}
        <div className="admin-ff-grid">
          <label>
            Nickname
            <input name="nickname" defaultValue={friend?.nickname ?? ""} maxLength={60} required />
          </label>
          <label>
            Tagline <small>(under the name)</small>
            <input name="productName" defaultValue={friend?.productName ?? ""} maxLength={80} />
          </label>
          <label>
            Slug
            <input name="slug" defaultValue={friend?.slug ?? ""} maxLength={60} placeholder="auto from nickname" />
          </label>
          <label>
            Collection <small>(season we met)</small>
            <CollectionSelect name="collection" defaultValue={friend?.collection ?? ""} />
          </label>
          <label>
            Birthday <small>(the price)</small>
            <BirthdaySelect name="birthday" defaultValue={friend?.birthday ?? ""} />
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
            Relationship <small>(in stock)</small>
            <input name="relationship" list="ff-relationships" defaultValue={friend?.relationship ?? "Friend"} maxLength={40} />
            <datalist id="ff-relationships">
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <label>
            Badge
            <select name="badge" defaultValue={friend?.badge ?? "none"}>
              {(Object.keys(FRIEND_BADGES) as FriendBadge[]).map((key) => (
                <option key={key} value={key}>
                  {FRIEND_BADGES[key] || "None"}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-friend-check">
            <input type="checkbox" name="visible" defaultChecked={friend?.visible ?? false} /> Visible in the shop
          </label>
        </div>
        <label className="admin-ff-block">
          Backroom notes <small>(never shown in the shop)</small>
          <textarea name="notes" rows={3} defaultValue={friend?.notes ?? ""} />
        </label>
      </section>

      <section className="admin-ff-section" hidden={!show("words")}>
        {all ? <h4>Words</h4> : null}
        <label className="admin-ff-block">
          Favorite memory
          <textarea name="favoriteMemory" rows={6} defaultValue={friend?.favoriteMemory ?? ""} />
        </label>
        <label className="admin-ff-block">
          Care instructions <small>(optional)</small>
          <textarea name="care" rows={3} defaultValue={friend?.care ?? ""} placeholder="Do not text before 10am. Feed regularly. Handle with jokes." />
        </label>
      </section>

      <section className="admin-ff-section" hidden={!show("poem")}>
        {all ? <h4>Poem</h4> : null}
        <PoemFields title={friend?.poemTitle ?? ""} poet={friend?.poemPoet ?? ""} url={friend?.poemUrl ?? ""} />
      </section>

      <section className="admin-ff-section" hidden={!show("madeOf")}>
        {all ? <h4>Made of</h4> : null}
        <div className="admin-friend-field">
          <span className="admin-friend-label">
            Pick two or three. <small>Shows on their page as what they are made of.</small>
          </span>
          <MadeOfPicker selected={friend?.madeOf ?? []} />
        </div>
      </section>
    </>
  );

  if (friend) {
    return (
      <AutoSaveForm action={updateFriendForm} className="admin-friend-form" onStatus={onStatus} showStatus={false}>
        <input type="hidden" name="id" value={friend.id} />
        {fields}
      </AutoSaveForm>
    );
  }
  return (
    <form action={createFriendForm} className="admin-friend-form admin-friend-form-new">
      {fields}
      <div className="admin-roll-actions">
        <button type="submit">Add friend</button>
      </div>
    </form>
  );
}
