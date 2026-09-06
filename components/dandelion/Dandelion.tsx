"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Wish } from "@/lib/dandelion-types";
import { WIND_MISS } from "@/lib/dandelion-types";

type Seed = Wish & {
  x: number;
  y: number;
  dur: number;
  delay: number;
  spin: number;
  fly: number;
};

const BURST = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: 22 + (i % 5) * 2.4,
  y: 16 + (i % 4) * 3.5,
  fly: 38 + (i % 7) * 6,
  lift: 6 + (i % 5) * 4,
  spin: (i % 11) - 5,
  delay: i * 0.04,
}));

function hash(value: string) {
  let n = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    n ^= value.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

function seedPose(wish: Wish): Seed {
  const n = hash(wish.id);
  return {
    ...wish,
    x: 58 + (n % 34),
    y: 8 + ((n >>> 10) % 30),
    dur: 11 + (n % 9),
    delay: -((n >>> 4) % 12),
    spin: (n % 21) - 10,
    fly: 42 + (n % 28),
  };
}

type Phase = "still" | "shiver" | "blowing";

function wishNote(wish: Wish) {
  return [
    wish.location,
    wish.gender,
    wish.age ? `${wish.age} years old` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function Dandelion() {
  const [draft, setDraft] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [phase, setPhase] = useState<Phase>("still");
  const [opened, setOpened] = useState(false);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [caught, setCaught] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const catchTimer = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/dandelion/wishes")
      .then((response) => response.json())
      .then((data: { opened?: boolean; wishes?: Wish[] }) => {
        setOpened(Boolean(data.opened));
        setWishes(data.wishes ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (catchTimer.current) window.clearTimeout(catchTimer.current);
    };
  }, []);

  const seeds = useMemo(
    () => wishes.map(seedPose),
    [wishes],
  );

  function catchSeed(id: string) {
    if (phase === "blowing") return;
    setCaught(id);
    if (catchTimer.current) window.clearTimeout(catchTimer.current);
    catchTimer.current = window.setTimeout(() => setCaught(null), 4200);
  }

  async function blow() {
    if (busy || phase === "blowing") return;
    const wish = draft.trim();
    if (wish.length < 2) {
      setPhase("shiver");
      window.setTimeout(() => setPhase("still"), 420);
      setError("");
      return;
    }
    if (!gender || !age) {
      setError("choose your gender and age");
      return;
    }
    setBusy(true);
    setError("");
    setCaught(null);
    setPhase("blowing");
    try {
      const response = await fetch("/api/dandelion/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wish, gender, age }),
      });
      const data = (await response.json()) as {
        error?: string;
        opened?: boolean;
        wishes?: Wish[];
      };
      if (!response.ok) {
        setBusy(false);
        setPhase("still");
        setError(data.error ?? WIND_MISS);
        return;
      }
      setDraft("");
      setGender("");
      setAge("");
      window.setTimeout(() => {
        setOpened(true);
        setWishes(data.wishes ?? []);
        setPhase("still");
        setBusy(false);
      }, 1100);
    } catch {
      setBusy(false);
      setPhase("still");
      setError(WIND_MISS);
    }
  }

  return (
    <div className={`dandelion-field is-${phase}${opened ? " is-open" : ""}`}>
      <img
        className="dandelion-art"
        src="/dandelion/clemi-blow.png?v=hd4"
        alt="Clementine blowing a fat dandelion"
      />
      {mounted && phase === "blowing"
        ? BURST.map((bit) => (
            <span
              key={`burst-${bit.id}`}
              className="dandelion-burst"
              style={
                {
                  left: `${bit.x}%`,
                  top: `${bit.y}%`,
                  "--fly": `${bit.fly}vw`,
                  "--lift": `${bit.lift}vh`,
                  "--spin": `${bit.spin}deg`,
                  "--delay": `${bit.delay}s`,
                } as React.CSSProperties
              }
              aria-hidden="true"
            >
              <svg viewBox="0 0 18 28">
                <path
                  d="M9 2c3.2 2.2 4.8 6.2 0 8.2C4.8 8.2 5.8 4.2 9 2Z"
                  fill="currentColor"
                />
                <path
                  d="M9 10.2 9 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          ))
        : null}
      {mounted
        ? seeds.map((seed) => (
        <button
          type="button"
          key={seed.id}
          className={`dandelion-seed${caught === seed.id ? " is-caught" : ""}`}
          style={
            {
              left: `${seed.x}%`,
              top: `${seed.y}%`,
              "--dur": `${seed.dur}s`,
              "--delay": `${seed.delay}s`,
              "--spin": `${seed.spin}deg`,
              "--fly": `${seed.fly}vw`,
            } as React.CSSProperties
          }
          onClick={() => catchSeed(seed.id)}
          aria-label={opened ? "A wish" : "A hidden wish"}
        >
          <svg viewBox="0 0 18 28" aria-hidden="true">
            <path
              d="M9 2c3.2 2.2 4.8 6.2 0 8.2C4.8 8.2 5.8 4.2 9 2Z"
              fill="currentColor"
            />
            <path
              d="M9 10.2 9 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </svg>
          {caught === seed.id ? (
            <span className="seed-wish">
              {opened ? seed.body : "hidden"}
              {opened && wishNote(seed) ? (
                <span className="seed-meta">{wishNote(seed)}</span>
              ) : null}
            </span>
          ) : null}
        </button>
      ))
        : null}

      <div className="dandelion-plant">
        <p className="dandelion-lede">
          this fat dandelion may make all your dreams come true!
        </p>
        <form
          className="dandelion-form"
          onSubmit={(event) => {
            event.preventDefault();
            blow();
          }}
        >
          <input
            value={draft}
            maxLength={100}
            placeholder="make a wish to see other people's wishes"
            autoComplete="off"
            autoCorrect="off"
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
          />
          {draft.trim() ? (
            <div className="dandelion-extras">
              <label>
                <span>gender</span>
                <select
                  value={gender}
                  required
                  aria-label="gender"
                  onChange={(event) => {
                    setGender(event.target.value);
                    setError("");
                  }}
                >
                  <option value="" disabled>
                    select
                  </option>
                  <option value="m">m</option>
                  <option value="f">f</option>
                  <option value="other">other</option>
                  <option value="fruit">fruit</option>
                  <option value="bunny">bunny</option>
                </select>
              </label>
              <label>
                <span>age</span>
                <input
                  type="number"
                  min={10}
                  max={100}
                  step={1}
                  required
                  value={age}
                  placeholder="10–100"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="age"
                  onChange={(event) => {
                    setAge(event.target.value);
                    setError("");
                  }}
                />
              </label>
            </div>
          ) : null}
          <button type="submit" className="dandelion-blow">
            blow
          </button>
        </form>
        {error ? <p className="dandelion-error">{error}</p> : null}
      </div>
    </div>
  );
}
