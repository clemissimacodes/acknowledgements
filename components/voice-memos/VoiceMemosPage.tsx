import { currentUser } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin";
import {
  heartedByVisitor,
  listAllNotes,
  listAllReplies,
  listRecordings,
} from "@/lib/recordings";
import { visitorHash } from "@/lib/recording-visitor";
import { VoiceMemosApp } from "./VoiceMemosApp";
import styles from "./VoiceMemos.module.css";

export async function VoiceMemosPage({ slug }: { slug: string | null }) {
  const [recordings, notes, replies, user, hash] = await Promise.all([
    listRecordings().catch(() => []),
    listAllNotes().catch(() => []),
    listAllReplies().catch(() => []),
    currentUser().catch(() => null),
    visitorHash(),
  ]);
  const hearted = await heartedByVisitor(hash).catch(() => []);

  return (
    <main className={`${styles.page} voice-memos-page`}>
      <h1 className="visually-hidden">Voice Memos</h1>
      <div className={styles.window}>
        <div className={styles.titlebar} aria-hidden="true">
          <span className={styles.lights}>
            <i />
            <i />
            <i />
          </span>
          <p className={styles.titlebarTitle}>Voice Memos</p>
        </div>
        <VoiceMemosApp
          recordings={recordings}
          notes={notes}
          replies={replies}
          hearted={hearted}
          initialSlug={slug}
          isOwner={isAdminUser(user)}
        />
      </div>
      <p className={styles.shortcuts}>
        <kbd>space</kbd> play · <kbd>←</kbd> <kbd>→</kbd> 15s · <kbd>↑</kbd>{" "}
        <kbd>↓</kbd> recordings · <kbd>F</kbd> heart · <kbd>L</kbd> loop
      </p>
    </main>
  );
}
