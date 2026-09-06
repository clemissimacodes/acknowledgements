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

function formatLocation(x: number, y: number) {
  const latitude = 90 - y * 180;
  const longitude = x * 360 - 180;
  const lat = `${Math.abs(latitude).toFixed(1)}° ${latitude >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(longitude).toFixed(1)}° ${longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lng}`;
}

export function Dandelion() {
  const [draft, setDraft] = useState("");
  const [location, setLocation] = useState("");
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
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
    if (!location || !gender || !age) {
      setError("drop a pin, then choose your gender and age");
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
        body: JSON.stringify({ wish, location, gender, age }),
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
      setLocation("");
      setPin(null);
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
        src="/dandelion/clemi-blow.png?v=hd2"
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
            <>
              <div className="dandelion-map-field">
                <span className="dandelion-field-label">
                  {location || "drop a pin where you are"}
                </span>
                <button
                  className="dandelion-map"
                  type="button"
                  aria-label="Select your approximate location on the world map"
                  onClick={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const keyboard = event.detail === 0;
                    const x = keyboard
                      ? 0.5
                      : Math.min(
                          1,
                          Math.max(
                            0,
                            (event.clientX - bounds.left) / bounds.width,
                          ),
                        );
                    const y = keyboard
                      ? 0.5
                      : Math.min(
                          1,
                          Math.max(
                            0,
                            (event.clientY - bounds.top) / bounds.height,
                          ),
                        );
                    setPin({ x, y });
                    setLocation(formatLocation(x, y));
                    setError("");
                  }}
                >
                  <svg viewBox="0 0 360 180" aria-hidden="true">
                    <path d="M19 51 38 31l27-9 18 9 16-5 21 16-9 14-20 2-9 17-15 5-6 27-17 12-9-24-15-8-9-20Zm91 75 15-17 13 8 9 28-11 27-13-8-6-22Zm50-83 22-17 31 1 9 12 24-1 22 12 27-4 29 17-7 17-23 5-11 23-18-2-8 20-13 13-16-16-7-28-18-11-15-23-27-3Zm111 88 18-11 27 7 18 18-8 16-24 5-17-12Z" />
                    <path
                      className="dandelion-map-lines"
                      d="M0 45h360M0 90h360M0 135h360M90 0v180M180 0v180M270 0v180"
                    />
                  </svg>
                  {pin ? (
                    <span
                      className="dandelion-pin"
                      style={{
                        left: `${pin.x * 100}%`,
                        top: `${pin.y * 100}%`,
                      }}
                    />
                  ) : null}
                </button>
              </div>
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
            </>
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
