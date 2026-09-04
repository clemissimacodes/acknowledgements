"use client";

import { usePathname } from "next/navigation";
import type { Note } from "@/lib/types";
import { ConversationList } from "./ConversationList";
import { ThemeSwitch } from "./ThemeSwitch";

export function MessagesShell({
  notes,
  children,
}: {
  notes: Note[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0] === "acknowledgements" && parts[1] ? parts[1] : undefined;
  const mode = slug ? "is-thread" : "is-list";

  return (
    <div className={`shell ${mode}`}>
      <aside className="sidebar">
        <div className="mac-toolbar">
          <span className="traffic" aria-hidden="true">
            <i className="close" />
            <i className="min" />
            <i className="zoom" />
          </span>
          <span className="app-name">Messages</span>
          <ThemeSwitch />
        </div>
        <div className="ios-header">
          <div className="ios-header-row">
            <h1>Messages</h1>
            <ThemeSwitch />
          </div>
        </div>
        <ConversationList notes={notes} activeSlug={slug} />
      </aside>
      <section className="thread-pane" aria-label={slug ? "Conversation" : "No conversation selected"}>
        {children}
      </section>
    </div>
  );
}
