"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
export type SaveStatus = { state: SaveState; text: string };

type Props = {
  action: (form: FormData) => Promise<void>;
  className?: string;
  children: ReactNode;
  /* ms of quiet after typing before a save; selects and checkboxes save at once */
  delay?: number;
  /* Lift the status text somewhere else (a sticky header, say). */
  onStatus?: (status: SaveStatus) => void;
  /* Render the small status line under the fields. */
  showStatus?: boolean;
};

function clock() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function statusText(state: SaveState, savedAt: string, message: string) {
  return state === "saving"
    ? "Saving…"
    : state === "dirty"
      ? "Unsaved edits…"
      : state === "error"
        ? message || "Save failed."
        : state === "saved"
          ? `Saved ${savedAt}`
          : "Saves automatically";
}

/* A form that saves itself: immediately for selects/checkboxes, after a pause for text.
   Inputs stay uncontrolled so a save re-render never eats what you are typing.
   Every change snapshots the form, so a pending save survives the form unmounting
   (jumping to the next person) and the page closing. */
export function AutoSaveForm({ action, className, children, delay = 900, onStatus, showStatus = true }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<FormData | null>(null);
  const queued = useRef(false);
  const inflight = useRef(false);
  const mounted = useRef(true);
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState("");
  const [message, setMessage] = useState("");

  const put = useCallback(
    (next: SaveState, nextMessage = "", nextSavedAt?: string) => {
      if (!mounted.current) return;
      setState(next);
      setMessage(nextMessage);
      if (nextSavedAt !== undefined) setSavedAt(nextSavedAt);
    },
    [],
  );

  const save = useCallback(async () => {
    const data = pending.current;
    if (!data) return;
    if (inflight.current) {
      queued.current = true;
      return;
    }
    const form = ref.current;
    if (form && !form.reportValidity()) {
      put("error", "Fix the highlighted field.");
      return;
    }
    pending.current = null;
    inflight.current = true;
    put("saving");
    try {
      await action(data);
      put("saved", "", clock());
    } catch (error) {
      pending.current = pending.current ?? data;
      put("error", error instanceof Error ? error.message : "Save failed.");
    } finally {
      inflight.current = false;
      if (queued.current) {
        queued.current = false;
        void save();
      }
    }
  }, [action, put]);

  const schedule = (immediate: boolean) => {
    const form = ref.current;
    if (!form) return;
    pending.current = new FormData(form);
    put("dirty");
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void save();
    else timer.current = setTimeout(() => void save(), delay);
  };

  const onChange = (event: React.FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLInputElement;
    const instant = target.tagName === "SELECT" || target.type === "checkbox" || target.type === "radio" || target.type === "number";
    schedule(instant);
  };

  useEffect(() => {
    onStatus?.({ state, text: statusText(state, savedAt, message) });
  }, [state, savedAt, message, onStatus]);

  /* Leaving the tab, the page, or this form with a pending edit: save now. */
  useEffect(() => {
    mounted.current = true;
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (pending.current) void save();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
      mounted.current = false;
      flush();
    };
  }, [save]);

  return (
    <form
      ref={ref}
      className={className}
      autoComplete="off"
      onChange={onChange}
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        if (!pending.current && ref.current) pending.current = new FormData(ref.current);
        void save();
      }}
    >
      {children}
      {showStatus ? (
        <p className={`admin-autosave admin-autosave-${state}`} aria-live="polite">
          {statusText(state, savedAt, message)}
          {state === "error" ? (
            <button type="submit" className="admin-autosave-retry">
              Retry
            </button>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
