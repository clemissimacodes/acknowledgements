import Link from "next/link";
import { removeAskQuestion, replyToAskQuestion } from "@/app/(volume)/ask/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ASK_ANSWER_MAX_LENGTH, listAskQuestions } from "@/lib/ask";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ask Me Anything · Control room",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AskControlPage() {
  const questions = await listAskQuestions(1000).catch(() => []);
  const pending = questions.filter((item) => !item.answer);
  const answered = questions.filter((item) => item.answer);

  return (
    <main className="admin-page admin-rolls">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">
            <Link href="/controlroom">Control room</Link> · ask
          </p>
          <h1>Ask Me Anything</h1>
          <p className="admin-private">
            Anonymous questions, thoughts and well wishes. Every one is already
            public on its own page the moment it is sent; your reply appears
            there and in the index. Delete anything you would rather not host.
          </p>
        </div>
        <Link href="/ask">View the index →</Link>
      </header>

      {questions.length === 0 ? (
        <p className="admin-muted">Nothing asked yet.</p>
      ) : null}

      {[
        { title: `Waiting (${pending.length})`, items: pending },
        { title: `Replied (${answered.length})`, items: answered },
      ].map((group) =>
        group.items.length ? (
          <section className="admin-section" key={group.title}>
            <h2>{group.title}</h2>
            <div className="admin-ask-list">
              {group.items.map((item) => (
                <article className="admin-ask" key={item.id} id={item.id}>
                  <p className="admin-muted">
                    {dateFormat.format(new Date(item.createdAt))} · opened{" "}
                    {item.opens} · <Link href={`/ask/${item.id}`}>page</Link>
                  </p>
                  <blockquote>{item.body}</blockquote>
                  <form action={replyToAskQuestion} className="admin-edit-form">
                    <input type="hidden" name="id" value={item.id} />
                    <label>
                      Reply (leave empty to un-reply)
                      <textarea
                        name="answer"
                        rows={3}
                        maxLength={ASK_ANSWER_MAX_LENGTH}
                        defaultValue={item.answer ?? ""}
                      />
                    </label>
                    <div className="admin-roll-actions">
                      <button type="submit">
                        {item.answer ? "Update reply" : "Reply"}
                      </button>
                    </div>
                  </form>
                  <form action={removeAskQuestion}>
                    <input type="hidden" name="id" value={item.id} />
                    <ConfirmButton
                      className="admin-danger"
                      message="Delete this question and its page? This cannot be undone."
                    >
                      Delete
                    </ConfirmButton>
                  </form>
                </article>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </main>
  );
}
