"use client";

import { useState } from "react";
import { MADE_OF, MADE_OF_MAX } from "@/lib/friend-types";

type Props = { selected: string[] };

/* Chips with checkboxes named "madeOf". Caps at MADE_OF_MAX; anything saved
   that is no longer in the list is still shown so it can be unticked. */
export function MadeOfPicker({ selected }: Props) {
  const [picked, setPicked] = useState<string[]>(selected);
  const options = [...MADE_OF, ...selected.filter((s) => !(MADE_OF as readonly string[]).includes(s))];
  const full = picked.length >= MADE_OF_MAX;

  return (
    <div className="admin-chips" role="group" aria-label="Made of">
      {options.map((attr) => {
        const on = picked.includes(attr);
        return (
          <label key={attr} className={`admin-chip${on ? " is-on" : ""}${!on && full ? " is-off" : ""}`}>
            <input
              type="checkbox"
              name="madeOf"
              value={attr}
              checked={on}
              disabled={!on && full}
              onChange={(event) =>
                setPicked((prev) => (event.target.checked ? [...prev, attr] : prev.filter((p) => p !== attr)))
              }
            />
            {attr}
          </label>
        );
      })}
      <span className="admin-chips-count">
        {picked.length}/{MADE_OF_MAX}
      </span>
    </div>
  );
}
