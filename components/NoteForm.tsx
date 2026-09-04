"use client";

import { useState } from "react";

export function NoteForm() {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function send(event: React.FormEvent) {
    event.preventDefault();
    const from = name.trim();
    const note = body.trim();
    if (from.length < 2) {
      setError("Leave your name.");
      return;
    }
    if (note.length < 2) {
      setError("Write a little more.");
      return;
    }
    setError("");
    const user = ["clem", "shao"].join("");
    const domain = ["gmail", "com"].join(".");
    const subject = encodeURIComponent(`A note from ${from}`);
    const text = encodeURIComponent(`${from} writes:\n\n${note}`);
    window.location.href = `mailto:${user}@${domain}?subject=${subject}&body=${text}`;
    setSent(true);
  }

  if (sent) {
    return <p className="note-thanks">I will read it.</p>;
  }

  return (
    <form className="note-letter" onSubmit={send}>
      <label>
        <span>your name</span>
        <input
          name="from"
          required
          minLength={2}
          maxLength={80}
          autoComplete="nickname"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        <span>a note or a question</span>
        <textarea
          name="note"
          required
          minLength={2}
          maxLength={4000}
          rows={7}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <button type="submit">Leave it</button>
      {error ? <p className="unlock-error">{error}</p> : null}
    </form>
  );
}
