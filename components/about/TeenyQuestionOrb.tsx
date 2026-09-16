"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import {
  sendTeenyQuestion,
  type TeenyQuestionFormState,
} from "@/app/(volume)/teeny-tiny-things/actions";
import { NoseCamera } from "./NoseCamera";
import styles from "./TeenyQuestionOrb.module.css";

const initialState: TeenyQuestionFormState = {
  status: "idle",
  message: "",
};

export function TeenyQuestionOrb() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"words" | "nose">("words");
  const [hasNoseEvidence, setHasNoseEvidence] = useState(false);
  const [hideEvidenceError, setHideEvidenceError] = useState(false);
  const [state, action, pending] = useActionState(sendTeenyQuestion, initialState);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setStep("words");
    setHasNoseEvidence(false);
    setHideEvidenceError(false);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);
  const handleEvidenceValidity = useCallback((valid: boolean) => {
    setHasNoseEvidence(valid);
    if (valid) setHideEvidenceError(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleKeys);
    dialogRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    return () => window.removeEventListener("keydown", handleKeys);
  }, [closeDialog, open]);

  return (
    <>
      <button
        className={styles.orb}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        ref={openerRef}
      >
        <span>ur welcome to<br />stick ur nose in too</span>
      </button>

      {open ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onClick={closeDialog}
        >
          <div
            className={`${styles.dialog}${
              state.status === "sent" ? ` ${styles.dialogSent}` : ""
            }${step === "nose" ? ` ${styles.dialogNose}` : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="teeny-question-title"
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className={styles.close}
              type="button"
              onClick={closeDialog}
              aria-label="Close"
            >
              ×
            </button>
            <h2 id="teeny-question-title">
              ask me any teeny tiny
              <br />
              (or elephantine) thing
            </h2>
            {state.status === "sent" ? (
              <p className={styles.sent}>{state.message}</p>
            ) : (
              <form
                action={action}
                ref={formRef}
                onSubmit={() => setHideEvidenceError(false)}
              >
                <div className={styles.step} hidden={step !== "words"}>
                  <label>
                    <span>Your thing</span>
                    <textarea
                      name="question"
                      required
                      minLength={3}
                      maxLength={500}
                      rows={3}
                    />
                  </label>
                  <label>
                    <span>earthly name or alter ego idc</span>
                    <input name="name" maxLength={80} autoComplete="name" />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const question = formRef.current?.elements.namedItem(
                        "question",
                      ) as HTMLTextAreaElement | null;
                      if (question?.reportValidity()) setStep("nose");
                    }}
                  >
                    next: nose
                  </button>
                </div>
                {step === "nose" ? (
                  <div className={styles.step}>
                    <NoseCamera
                      onValidityChange={handleEvidenceValidity}
                    />
                    {state.status === "error" && !hideEvidenceError ? (
                      <p className={styles.error}>{state.message}</p>
                    ) : null}
                    <div className={styles.noseNav}>
                      <button type="button" onClick={() => setStep("words")}>
                        ← words
                      </button>
                      <button
                        type="submit"
                        disabled={pending || !hasNoseEvidence}
                      >
                        {pending
                          ? "sending…"
                          : "send ur teeny tiny thing into orbit"}
                      </button>
                    </div>
                  </div>
                ) : null}
                <label className={styles.honeypot} aria-hidden="true">
                  Website
                  <input
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                </label>
              </form>
            )}
            <p className={styles.promise}>
              answering my anonymous inbox is my top priority in life actually,
              so expect to hear back within 3 minutes unless i am in a life/death
              situation with a pigeon
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
