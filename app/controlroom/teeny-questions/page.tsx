import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  removeTeenyQuestion,
  replyToTeenyQuestion,
} from "@/app/(volume)/teeny-tiny-things/actions";
import { isAdminUser } from "@/lib/admin";
import { getAllTeenyQuestions } from "@/lib/teeny-questions";
import styles from "./page.module.css";

export const metadata = {
  title: "Teeny Tiny Questions",
  robots: { index: false, follow: false },
};

export default async function TeenyQuestionsPage() {
  const user = await currentUser();
  if (!isAdminUser(user)) notFound();
  const questions = await getAllTeenyQuestions();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p>Control room</p>
        <h1>Teeny tiny questions</h1>
        <Link href="/teeny-tiny-things">View the orbit →</Link>
      </header>

      <div className={styles.list}>
        {questions.length ? (
          questions.map((item) => (
            <article key={item.id}>
              <p className={styles.meta}>
                {item.name || "Anonymous"} ·{" "}
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(item.createdAt))}
              </p>
              {item.nosePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.nose}
                  src={item.nosePhoto}
                  alt={`Nose submitted by ${item.name || "an anonymous human"}`}
                />
              ) : item.noseShy ? (
                <p className={styles.noseShy}>i am nose shy</p>
              ) : null}
              <blockquote>{item.question}</blockquote>
              <form action={replyToTeenyQuestion}>
                <input type="hidden" name="id" value={item.id} />
                <label>
                  Your reply
                  <textarea
                    name="answer"
                    required
                    maxLength={1000}
                    defaultValue={item.answer ?? ""}
                    rows={4}
                  />
                </label>
                <button type="submit">
                  {item.answer ? "Update reply" : "Reply + publish"}
                </button>
              </form>
              <form action={removeTeenyQuestion}>
                <input type="hidden" name="id" value={item.id} />
                <button className={styles.delete} type="submit">
                  Delete
                </button>
              </form>
            </article>
          ))
        ) : (
          <p>No tiny things yet.</p>
        )}
      </div>
    </main>
  );
}
