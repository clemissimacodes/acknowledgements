"use client";

import { useState } from "react";
import { MADE_OF, MADE_OF_MAX } from "@/lib/friend-types";

type Props = { selected: string[] };

/* The list is traits first, then materials. Split where the materials begin. */
const MATERIALS_AT = (MADE_OF as readonly string[]).indexOf("Moonlight");
const GROUPS: { label: string; items: readonly string[] }[] =
  MATERIALS_AT > 0
    ? [
        { label: "Traits", items: MADE_OF.slice(0, MATERIALS_AT) },
        { label: "Materials", items: MADE_OF.slice(MATERIALS_AT) },
      ]
    : [{ label: "", items: MADE_OF }];

/* Chips with checkboxes named "madeOf". Caps at MADE_OF_MAX; anything saved
   that is no longer in the list is still shown so it can be unticked. */
export function MadeOfPicker({ selected }: Props) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [filter, setFilter] = useState("");
  const full = picked.length >= MADE_OF_MAX;
  const q = filter.trim().toLowerCase();
  const extras = selected.filter((s) => !(MADE_OF as readonly string[]).includes(s));

  const chip = (attr: string) => {
    const on = picked.includes(attr);
    return (
      <label key={attr} className={`admin-chip${on ? " is-on" : ""}${!on && full ? " is-off" : ""}`}>
        <input
          type="checkbox"
          name="madeOf"
          value={attr}
          checked={on}
          disabled={!on && full}
          onChange={(event) => setPicked((prev) => (event.target.checked ? [...prev, attr] : prev.filter((p) => p !== attr)))}
        />
        {attr}
      </label>
    );
  };

  return (
    <div className="admin-madeof" role="group" aria-label="Made of">
      <div className="admin-madeof-top">
        <div className="admin-chips admin-madeof-picked">
          {picked.length ? picked.map(chip) : <span className="admin-muted">Nothing picked yet.</span>}
          <span className="admin-chips-count">
            {picked.length}/{MADE_OF_MAX}
          </span>
        </div>
        <input
          type="search"
          className="admin-madeof-filter"
          placeholder="Filter…"
          value={filter}
          onChange={(event) => {
            event.stopPropagation(); /* filtering is not an edit; don't wake autosave */
            setFilter(event.target.value);
          }}
        />
      </div>
      {GROUPS.map((group) => {
        const items = group.items.filter((a) => !picked.includes(a) && (!q || a.toLowerCase().includes(q)));
        if (!items.length) return null;
        return (
          <div key={group.label} className="admin-madeof-group">
            {group.label ? <span className="admin-friend-label">{group.label}</span> : null}
            <div className="admin-chips">{items.map(chip)}</div>
          </div>
        );
      })}
      {extras.filter((a) => !picked.includes(a)).length ? (
        <div className="admin-madeof-group">
          <span className="admin-friend-label">No longer on the list</span>
          <div className="admin-chips">{extras.filter((a) => !picked.includes(a)).map(chip)}</div>
        </div>
      ) : null}
    </div>
  );
}
