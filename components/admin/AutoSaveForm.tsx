"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  action: (form: FormData) => Promise<void>;
  className?: string;
  children: ReactNode;
  /* ms of quiet after typing before a save; selects and checkboxes save at once */
  delay?: number;
};

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function clock() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* A form that saves itself: immediately for selects/checkboxes, after a pause for text.
   Inputs stay uncontrolled so a save re-render never eats what you are typing. */
export function AutoSaveForm({ action, className, children, delay = 900 }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queued = useRef(false);
  const inflight = useRef(false);
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState("");
  const [message, setMessage] = useState("");

  const save = useCallback(async () => {
    const form = ref.current;
    if (!form) return;
    if (inflight.current) {
      queued.current = true;
      return;
    }
    if (!form.reportValidity()) {
      setState("error");
      setMessage("Fix the highlighted field.");
      return;
    }
    inflight.current = true;
    setState("saving");
    try {
      await action(new FormData(form));
      setState("saved");
      setSavedAt(clock());
      setMessage("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      inflight.current = false;
      if (queued.current) {
        queued.current = false;
        void save();
      }
    }
  }, [action]);

  const schedule = (immediate: boolean) => {
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void save();
    else timer.current = setTimeout(() => void save(), delay);
  };

  const onChange = (event: React.FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLInputElement;
    const instant = target.tagName === "SELECT" || target.type === "checkbox" || target.type === "radio" || target.type === "number";
    schedule(instant);
  };

  /* Leaving the tab or page with a pending edit: save now. */
  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void save();
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [save]);

  return (
    <form
      ref={ref}
      className={className}
      onChange={onChange}
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void save();
      }}
    >
      {children}
      <p className={`admin-autosave admin-autosave-${state}`} aria-live="polite">
        {state === "saving"
          ? "Saving…"
          : state === "dirty"
            ? "Unsaved edits…"
            : state === "error"
              ? `${message || "Save failed."} `
              : state === "saved"
                ? `Saved ${savedAt}`
                : "Saves automatically"}
        {state === "error" ? (
          <button type="submit" className="admin-autosave-retry">
            Retry
          </button>
        ) : null}
      </p>
    </form>
  );
}
