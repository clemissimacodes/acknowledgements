import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Note } from "@/lib/types";
import { initialsFor, threadStamp } from "@/lib/format";
import { ChevronBack, FaceGlyph, PlusGlyph, TinyChevron } from "./Icons";
import { ThemeSwitch } from "./ThemeSwitch";

function groupClass(index: number, total: number): string {
  if (total === 1) return "group-single has-tail";
  if (index === 0) return "group-first";
  if (index === total - 1) return "group-last has-tail";
  return "group-middle";
}

export function Thread({ note }: { note: Note }) {
  const stamp = threadStamp(note.date, note.place);

  return (
    <>
      <header className="thread-header">
        <Link className="back" href="/acknowledgements" aria-label="Back to Messages">
          <ChevronBack />
        </Link>
        <Link
          className="peer"
          href={`/acknowledgements/${note.slug}/contact`}
          aria-label={`Open contact card for ${note.name}`}
        >
          <span className="avatar" aria-hidden="true">
            {initialsFor(note.name)}
          </span>
          <span className="peer-name">
            {note.name}
            <TinyChevron />
          </span>
        </Link>
        <div className="thread-appearance">
          <ThemeSwitch />
        </div>
      </header>
      <div className="thread">
        <div className="thread-scroll">
          {stamp ? <p className="stamp">{stamp}</p> : null}
          {note.bubbles.length > 0 ? (
            <>
              <div className="bubbles">
                {note.bubbles.map((text, index) => (
                  <div
                    key={`${note.slug}-${index}`}
                    className={`bubble ${groupClass(index, note.bubbles.length)}`}
                  >
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p>{children}</p>,
                      }}
                    >
                      {text}
                    </ReactMarkdown>
                  </div>
                ))}
              </div>
              <p className="receipt">Sent</p>
            </>
          ) : null}
        </div>
      </div>
      <div className="composer">
        <span className="plus" aria-hidden="true">
          <PlusGlyph />
        </span>
        <div className="sent-field" role="status">
          Sent
        </div>
        <span className="emoji" aria-hidden="true">
          <FaceGlyph />
        </span>
      </div>
    </>
  );
}

export function EmptyThread() {
  return (
    <div className="empty" role="status">
      No Conversation Selected
    </div>
  );
}
