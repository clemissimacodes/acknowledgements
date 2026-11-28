"use client";

import { useState } from "react";

const REPLIES = [
  "Return denied. You can't return what nobody bought.",
  "Return denied. They came back anyway, like they always do.",
  "Return denied. Store policy, and also my policy.",
];

export function ReturnButton() {
  const [tries, setTries] = useState(0);
  return (
    <>
      <button type="button" className="ff-pill ff-pill-dark ff-add" onClick={() => setTries((n) => n + 1)}>
        {tries ? "Try again" : "Return to sender"}
      </button>
      {tries ? (
        <p className="bc-return-done" role="status">
          {REPLIES[(tries - 1) % REPLIES.length]}
        </p>
      ) : null}
    </>
  );
}
