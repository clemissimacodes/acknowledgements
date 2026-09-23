import type { PoemReactionId } from "@/lib/poem-reactions";

const PATHS: Record<PoemReactionId, string> = {
  // heart
  twice:
    "M12 20.2S4.6 15.7 4.6 10.4A4 4 0 0 1 12 8.1a4 4 0 0 1 7.4 2.3c0 5.3-7.4 9.8-7.4 9.8Z",
  // question mark
  molars: "M9.2 9.1a2.9 2.9 0 0 1 5.7.8c0 2.1-2.9 2.4-2.9 4.6M12 18.4h.01",
  // cat face: ears, head, eyes, whiskers
  whispered:
    "M7.2 5.4 5.6 11.6a6.4 6.4 0 1 0 12.8 0L16.8 5.4l-3 2.5a6.6 6.6 0 0 0-3.6 0Z M9.7 12.5h.01M14.3 12.5h.01 M2.8 13.6h2.6M18.6 13.6h2.6",
};

export function ReactionIcon({ id }: { id: PoemReactionId }) {
  return (
    <svg
      className="poem-reaction-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[id]} />
    </svg>
  );
}
