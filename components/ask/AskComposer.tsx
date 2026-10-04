"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { sendAskQuestion, type AskFormState } from "@/app/(volume)/ask/actions";

const INITIAL: AskFormState = { status: "idle", message: "" };

// One line that grows as you type, and a word to send it. Nothing else:
// no name, no email.
export function AskComposer({ maxLength }: { maxLength: number }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(sendAskQuestion, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.status === "sent") {
      formRef.current?.reset();
      if (fieldRef.current) fieldRef.current.style.height = "";
      router.refresh();
    }
  }, [state, router]);

  function grow(element: HTMLTextAreaElement) {
    element.style.height = "";
    element.style.height = `${element.scrollHeight}px`;
  }

  return (
    <form ref={formRef} action={formAction} className="ask-composer">
      <label className="visually-hidden" htmlFor="ask-body">
        Ask anything anonymously
      </label>
      <textarea
        id="ask-body"
        ref={fieldRef}
        name="body"
        rows={1}
        required
        minLength={2}
        maxLength={maxLength}
        placeholder="ask anything anonymously"
        disabled={pending}
        onInput={(event) => grow(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="visually-hidden"
      />
      <button type="submit" disabled={pending}>
        {pending ? "sending" : "send"}
      </button>
      <p
        className={`ask-composer-status${state.status === "error" ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {state.message}
      </p>
    </form>
  );
}
