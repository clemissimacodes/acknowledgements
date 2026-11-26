"use client";

import { useRef, useState, type ReactNode } from "react";
import { rosterUpdateForm } from "@/app/(shop)/actions";

type Props = { children: ReactNode };

/* Wraps the roster table. Any change in a row (tr[data-id]) saves that row:
   at once for selects/checkboxes, after a pause for text. */
export function RosterAutosave({ children }: Props) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState("");

  const saveRow = async (row: HTMLTableRowElement) => {
    const id = row.dataset.id;
    if (!id) return;
    const form = new FormData();
    form.append("ids", id);
    row.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((el) => {
      if (!el.name) return;
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        if (el.checked) form.append(el.name, "on");
        return;
      }
      form.append(el.name, el.value);
    });
    const name = row.dataset.name ?? id;
    setPending((n) => n + 1);
    row.classList.add("is-saving");
    try {
      await rosterUpdateForm(form);
      setFailed((list) => list.filter((n) => n !== name));
      setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    } catch {
      setFailed((list) => (list.includes(name) ? list : [...list, name]));
    } finally {
      setPending((n) => n - 1);
      row.classList.remove("is-saving");
    }
  };

  const onChange = (event: React.FormEvent<HTMLDivElement>) => {
    const target = event.target as HTMLInputElement;
    const row = target.closest<HTMLTableRowElement>("tr[data-id]");
    if (!row?.dataset.id) return;
    const id = row.dataset.id;
    const instant = target.tagName === "SELECT" || target.type === "checkbox";
    const prev = timers.current.get(id);
    if (prev) clearTimeout(prev);
    if (instant) void saveRow(row);
    else timers.current.set(id, setTimeout(() => void saveRow(row), 900));
  };

  return (
    <div onChange={onChange}>
      <p className={`admin-autosave admin-autosave-${failed.length ? "error" : pending ? "saving" : savedAt ? "saved" : "idle"}`} aria-live="polite">
        {failed.length
          ? `Could not save: ${failed.join(", ")}. Edit the row again to retry.`
          : pending
            ? "Saving…"
            : savedAt
              ? `Saved ${savedAt}`
              : "Every change saves on its own."}
      </p>
      {children}
    </div>
  );
}
