"use client";

import { useRef, useState } from "react";
import { lookupPoemMetaAction } from "@/app/(shop)/actions";
import { isPoetryFoundationUrl } from "@/lib/poem-meta";

type Props = {
  title?: string;
  poet?: string;
  url?: string;
};

/* Paste a Poetry Foundation link → title and poet fill themselves. Manual edits stick;
   only blank or previously auto-filled fields get overwritten. */
export function PoemFields({ title = "", poet = "", url = "" }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  const poetRef = useRef<HTMLInputElement>(null);
  const lastUrl = useRef(url);
  const [status, setStatus] = useState("");

  const write = (input: HTMLInputElement | null, value: string) => {
    if (!input || !value) return;
    const wasAuto = input.dataset.autofilled === "1";
    if (input.value && !wasAuto) return;
    input.value = value;
    input.dataset.autofilled = "1";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const lookup = async (raw: string) => {
    const next = raw.trim();
    if (!next || next === lastUrl.current) return;
    lastUrl.current = next;
    if (!isPoetryFoundationUrl(next)) {
      setStatus("");
      return;
    }
    setStatus("Looking up…");
    try {
      const meta = await lookupPoemMetaAction(next);
      write(titleRef.current, meta.title);
      write(poetRef.current, meta.poet);
      setStatus(
        meta.title && meta.poet
          ? `Filled: ${meta.title} · ${meta.poet}`
          : meta.title
            ? `Filled title; add the poet.`
            : "Couldn't read that page — fill title and poet.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Lookup failed.");
    }
  };

  return (
    <>
      <div className="admin-ff-grid admin-ff-grid-2">
        <label>
          Poem title
          <input
            ref={titleRef}
            name="poemTitle"
            defaultValue={title}
            placeholder="The Orange"
            onInput={(event) => {
              delete event.currentTarget.dataset.autofilled;
            }}
          />
        </label>
        <label>
          Poet
          <input
            ref={poetRef}
            name="poemPoet"
            defaultValue={poet}
            placeholder="Wendy Cope"
            onInput={(event) => {
              delete event.currentTarget.dataset.autofilled;
            }}
          />
        </label>
      </div>
      <label className="admin-ff-block">
        Poem link{" "}
        <a href="https://www.poetryfoundation.org/poems" target="_blank" rel="noreferrer">
          (browse Poetry Foundation)
        </a>
        <input
          name="poemUrl"
          type="url"
          defaultValue={url}
          placeholder="https://www.poetryfoundation.org/poems/…"
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (pasted) {
              /* Let the paste land, then look it up. */
              queueMicrotask(() => void lookup(pasted));
            }
          }}
          onBlur={(event) => void lookup(event.currentTarget.value)}
          onChange={(event) => {
            if (!event.currentTarget.value.trim()) {
              lastUrl.current = "";
              setStatus("");
            }
          }}
        />
        {status ? <small className="admin-poem-status">{status}</small> : null}
      </label>
    </>
  );
}
