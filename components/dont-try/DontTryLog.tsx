"use client";

import { useMemo, useState } from "react";
import type { DontTryEntry, DontTryStatus } from "@/lib/dont-try";
import {
  publishDontTryDay,
  saveAndPublishDontTryDay,
  saveDontTryDay,
  unpublishDontTryDay,
} from "@/app/(volume)/dont-try/actions";

type Filter = "all" | Exclude<DontTryStatus, "pending">;

function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function dateForDay(day: number) {
  const date = new Date("2026-09-10T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

function plankTime(seconds: number | null) {
  if (seconds === null) return "—";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function DayRecord({
  entry,
  open = false,
  anchor = false,
}: {
  entry: DontTryEntry;
  open?: boolean;
  anchor?: boolean;
}) {
  return (
    <details
      className={`dont-try-record is-${entry.status}`}
      id={anchor ? `day-${entry.day}` : undefined}
      open={open}
    >
      <summary>
        <span>Day {String(entry.day).padStart(3, "0")}</span>
        <time dateTime={entry.date}>{displayDate(entry.date)}</time>
        <strong>{entry.status}</strong>
      </summary>
      <div className="dont-try-record-body">
        <section>
          <h3>Study</h3>
          <p>
            {entry.studyPoem ? (
              <>
                <cite>“{entry.studyPoem}”</cite>
                {entry.studyAuthor ? ` — ${entry.studyAuthor}` : ""}
              </>
            ) : (
              "Not recorded."
            )}
          </p>
          {entry.studyNotes ? <p>{entry.studyNotes}</p> : null}
        </section>
        <section>
          <h3>Walk</h3>
          <p>
            {entry.steps === null
              ? "Not recorded."
              : `${entry.steps.toLocaleString()} / 12,000${entry.steps >= 12_000 ? " ✓" : ""}`}
          </p>
        </section>
        <section>
          <h3>Eat</h3>
          <p>
            {entry.eatComplete === null
              ? "Not recorded."
              : entry.eatComplete
                ? "Kept ✓"
                : "Not kept ✕"}
          </p>
          {entry.eatNotes ? <p>{entry.eatNotes}</p> : null}
        </section>
        <section>
          <h3>Act</h3>
          <p>{entry.act || "Not recorded."}</p>
          {entry.actDifficulty !== null ? (
            <p>Difficulty: {entry.actDifficulty}/10</p>
          ) : null}
        </section>
        <section>
          <h3>Train</h3>
          <p>{entry.workout || "Not recorded."}</p>
          <p>
            {entry.durationMinutes !== null
              ? `${entry.durationMinutes} min · `
              : ""}
            Plank: {plankTime(entry.plankSeconds)}
          </p>
          {entry.trainNotes ? <p>{entry.trainNotes}</p> : null}
        </section>
        {entry.setsAbandoned || entry.abandonedNotes ? (
          <section>
            <h3>Premature quitting</h3>
            <p>Sets abandoned: {entry.setsAbandoned}</p>
            {entry.abandonedNotes ? <p>{entry.abandonedNotes}</p> : null}
          </section>
        ) : null}
        <blockquote>{entry.verdict || "No verdict recorded."}</blockquote>
      </div>
    </details>
  );
}

function OwnerEditor({
  entries,
  currentDay,
}: {
  entries: DontTryEntry[];
  currentDay: number;
}) {
  const [day, setDay] = useState(currentDay);
  const entry = entries.find((item) => item.day === day);
  const empty = {
    day,
    date: dateForDay(day),
    status: "pending" as const,
    studyPoem: "",
    studyAuthor: "",
    studyNotes: "",
    steps: null,
    eatComplete: null,
    eatNotes: "",
    act: "",
    actDifficulty: null,
    workout: "",
    durationMinutes: null,
    plankSeconds: null,
    trainNotes: "",
    verdict: "",
    setsAbandoned: 0,
    abandonedNotes: "",
    publishedAt: null,
    updatedAt: "",
  } satisfies DontTryEntry;
  const selected = entry ?? empty;

  return (
    <details className="dont-try-owner">
      <summary>Owner logbook</summary>
      <div className="dont-try-owner-inner">
        <label className="dont-try-day-picker">
          Day
          <select value={day} onChange={(event) => setDay(Number(event.target.value))}>
            {Array.from({ length: 100 }, (_, index) => index + 1).map((value) => (
              <option value={value} key={value}>
                {String(value).padStart(3, "0")} · {displayDate(dateForDay(value))}
              </option>
            ))}
          </select>
        </label>
        <form className="dont-try-edit-form" action={saveDontTryDay} key={day}>
          <input type="hidden" name="day" value={day} />
          <label>
            Status
            <select name="status" defaultValue={selected.status}>
              <option value="pending">Pending</option>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="missed">Missed</option>
            </select>
          </label>
          <fieldset>
            <legend>Study</legend>
            <input name="studyPoem" defaultValue={selected.studyPoem} placeholder="Poem" aria-label="Poem studied" />
            <input name="studyAuthor" defaultValue={selected.studyAuthor} placeholder="Author" aria-label="Poem author" />
            <textarea name="studyNotes" defaultValue={selected.studyNotes} placeholder="What I learned" aria-label="Study notes" />
          </fieldset>
          <fieldset>
            <legend>Walk + eat</legend>
            <input name="steps" type="number" min="0" defaultValue={selected.steps ?? ""} placeholder="Steps" aria-label="Steps walked" />
            <select
              name="eatComplete"
              aria-label="Food promise status"
              defaultValue={
                selected.eatComplete === null
                  ? ""
                  : selected.eatComplete
                    ? "yes"
                    : "no"
              }
            >
              <option value="">Food status</option>
              <option value="yes">Kept</option>
              <option value="no">Not kept</option>
            </select>
            <textarea name="eatNotes" defaultValue={selected.eatNotes} placeholder="Food notes" aria-label="Food notes" />
          </fieldset>
          <fieldset>
            <legend>Act</legend>
            <textarea name="act" defaultValue={selected.act} placeholder="Act of courage" aria-label="Act of courage" />
            <input
              name="actDifficulty"
              type="number"
              min="1"
              max="10"
              defaultValue={selected.actDifficulty ?? ""}
              placeholder="Difficulty, 1–10"
              aria-label="Act difficulty from one to ten"
            />
          </fieldset>
          <fieldset>
            <legend>Train</legend>
            <input name="workout" defaultValue={selected.workout} placeholder="Workout" aria-label="Workout" />
            <div className="dont-try-edit-pair">
              <input
                name="durationMinutes"
                type="number"
                min="0"
                defaultValue={selected.durationMinutes ?? ""}
                placeholder="Minutes"
                aria-label="Workout duration in minutes"
              />
              <input
                name="plankSeconds"
                type="number"
                min="0"
                max="3600"
                defaultValue={selected.plankSeconds ?? ""}
                placeholder="Plank seconds"
                aria-label="Plank duration in seconds"
              />
            </div>
            <textarea name="trainNotes" defaultValue={selected.trainNotes} placeholder="Training notes" aria-label="Training notes" />
          </fieldset>
          <fieldset>
            <legend>Premature quitting</legend>
            <input
              name="setsAbandoned"
              type="number"
              min="0"
              defaultValue={selected.setsAbandoned}
              placeholder="Sets abandoned"
              aria-label="Sets abandoned"
            />
            <textarea
              name="abandonedNotes"
              defaultValue={selected.abandonedNotes}
              placeholder="What happened?"
              aria-label="Premature quitting notes"
            />
          </fieldset>
          <label>
            Daily verdict
            <input
              name="verdict"
              maxLength={180}
              defaultValue={selected.verdict}
              placeholder="One sentence maximum"
            />
          </label>
          <div className="dont-try-edit-actions">
            <button type="submit">Save draft</button>
            <button type="submit" formAction={saveAndPublishDontTryDay}>
              Save + publish
            </button>
          </div>
        </form>
        <div className="dont-try-publish-row">
          {selected.publishedAt ? (
            <form action={unpublishDontTryDay}>
              <input type="hidden" name="day" value={day} />
              <button type="submit">Unpublish day {day}</button>
            </form>
          ) : (
            <form action={publishDontTryDay}>
              <input type="hidden" name="day" value={day} />
              <button type="submit" disabled={selected.status === "pending"}>
                Publish day {day}
              </button>
            </form>
          )}
          <small>
            {selected.publishedAt ? "Public" : "Private draft"} · save before
            publishing
          </small>
        </div>
      </div>
    </details>
  );
}

export function DontTryLog({
  entries,
  ownerEntries,
  currentDay,
  canEdit,
}: {
  entries: DontTryEntry[];
  ownerEntries: DontTryEntry[];
  currentDay: number;
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = useMemo(
    () =>
      filter === "all"
        ? entries
        : entries.filter((entry) => entry.status === filter),
    [entries, filter],
  );
  const entriesByDay = useMemo(
    () => new Map(entries.map((entry) => [entry.day, entry])),
    [entries],
  );
  const today = entriesByDay.get(currentDay);

  return (
    <>
      <section className="dont-try-today" aria-labelledby="dont-try-today-title">
        <div className="dont-try-section-heading">
          <h2 id="dont-try-today-title">Today</h2>
          <span>Day {String(currentDay).padStart(3, "0")}</span>
        </div>
        {today ? (
          <DayRecord entry={today} open />
        ) : (
          <p className="dont-try-empty">
            Today’s record has not been published.
          </p>
        )}
      </section>

      {canEdit ? (
        <OwnerEditor entries={ownerEntries} currentDay={currentDay} />
      ) : null}

      <section className="dont-try-archive" aria-labelledby="dont-try-archive-title">
        <div className="dont-try-section-heading">
          <h2 id="dont-try-archive-title">Daily log</h2>
          <div className="dont-try-filters" aria-label="Filter daily log">
            {(["all", "complete", "partial", "missed"] as const).map((value) => (
              <button
                type="button"
                className={filter === value ? "is-active" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                key={value}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="dont-try-records">
          {filtered.length ? (
            filtered.map((entry) => (
              <DayRecord entry={entry} anchor key={entry.day} />
            ))
          ) : (
            <p className="dont-try-empty">No published records yet.</p>
          )}
        </div>
      </section>

      <section className="dont-try-calendar" aria-labelledby="dont-try-calendar-title">
        <div className="dont-try-section-heading">
          <h2 id="dont-try-calendar-title">One hundred days</h2>
          <span>Accurate, not perfect</span>
        </div>
        <ol>
          {Array.from({ length: 100 }, (_, index) => index + 1).map((day) => {
            const entry = entriesByDay.get(day);
            return (
              <li key={day}>
                <button
                  type="button"
                  className={entry ? `is-${entry.status}` : ""}
                  disabled={!entry}
                  title={
                    entry
                      ? `Day ${day}: ${entry.status}`
                      : `Day ${day}: not published`
                  }
                  onClick={() => {
                    document
                      .getElementById(`day-${day}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  {String(day).padStart(2, "0")}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
