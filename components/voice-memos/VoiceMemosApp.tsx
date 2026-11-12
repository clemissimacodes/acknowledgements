"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  FOLDER_LABELS,
  VIEW_LABELS,
  formatClock,
  formatPlayhead,
  formatRecordingDate,
  formatRecordingTime,
  type Recording,
  type RecordingNote,
  type RecordingReply,
  type RecordingView,
} from "@/lib/recording-types";
import {
  moveToTrash,
  removeNote,
  removeReply,
  setFavorite,
} from "@/app/(volume)/voice-memos/actions";
import { computePeaks, decodeAudio, findSilences, type Silence } from "./audio";
import {
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  HeartIcon,
  LoopIcon,
  MicBadgeIcon,
  NoteBadgeIcon,
  OptionsIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  ShareIcon,
  Skip15Icon,
  TrashIcon,
} from "./Icons";
import { ReplyRecorder } from "./ReplyRecorder";
import { Overview, Waveform, type LoopRegion } from "./Waveforms";
import styles from "./VoiceMemos.module.css";

type Props = {
  recordings: Recording[];
  notes: RecordingNote[];
  replies: RecordingReply[];
  hearted: string[];
  initialSlug: string | null;
  isOwner: boolean;
};

const SKIP_SECONDS = 15;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function parseStartTime(search: string) {
  const raw = new URLSearchParams(search).get("t");
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function VoiceMemosApp({
  recordings: initialRecordings,
  notes: initialNotes,
  replies: initialReplies,
  hearted: initialHearted,
  initialSlug,
  isOwner,
}: Props) {
  const [recordings, setRecordings] = useState(initialRecordings);
  const [notes, setNotes] = useState(initialNotes);
  const [replies, setReplies] = useState(initialReplies);
  const [hearted, setHearted] = useState(() => new Set(initialHearted));
  const [view, setView] = useState<RecordingView>("all");
  const [pickingFolder, setPickingFolder] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const match = initialSlug
      ? initialRecordings.find((item) => item.slug === initialSlug)
      : null;
    return match?.id ?? null;
  });
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialSlug));

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [skipSilence, setSkipSilence] = useState(false);
  const [loop, setLoop] = useState<LoopRegion | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [peaksById, setPeaksById] = useState<Record<string, number[]>>({});
  const [silencesById, setSilencesById] = useState<Record<string, Silence[]>>({});
  const resumeAfterScrub = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const [, startTransition] = useTransition();

  const selected = useMemo(
    () => recordings.find((item) => item.id === selectedId) ?? null,
    [recordings, selectedId],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recordings.filter((item) => {
      if (view === "favorites" && !item.favorite) return false;
      if ((view === "notes" || view === "singing") && item.folder !== view) {
        return false;
      }
      if (needle && !item.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [recordings, view, query]);

  const counts = useMemo(
    () => ({
      all: recordings.length,
      favorites: recordings.filter((item) => item.favorite).length,
      notes: recordings.filter((item) => item.folder === "notes").length,
      singing: recordings.filter((item) => item.folder === "singing").length,
      stories: recordings.filter((item) => item.folder === "stories").length,
      dreams: recordings.filter((item) => item.folder === "dreams").length,
    }),
    [recordings],
  );

  const selectedNotes = useMemo(
    () => notes.filter((note) => note.recordingId === selectedId),
    [notes, selectedId],
  );
  const selectedReplies = useMemo(
    () => replies.filter((reply) => reply.recordingId === selectedId),
    [replies, selectedId],
  );

  const peaks = selected ? peaksById[selected.id] ?? selected.peaks : null;
  const silences = selected ? silencesById[selected.id] : undefined;

  /* ---- selection + URL ---------------------------------------------- */

  const select = useCallback(
    (id: string | null, options: { openDetail?: boolean } = {}) => {
      setSelectedId(id);
      setLoop(null);
      setOptionsOpen(false);
      setShareOpen(false);
      if (options.openDetail) setMobileDetail(true);
      const target = recordings.find((item) => item.id === id);
      const path = target ? `/voice-memos/${target.slug}` : "/voice-memos";
      if (window.location.pathname !== path) {
        window.history.replaceState(null, "", path);
      }
    },
    [recordings],
  );

  useEffect(() => {
    // Deep links may carry a start time: /voice-memos/slug?t=83 or ?t=1:23.
    const start = parseStartTime(window.location.search);
    if (start > 0) pendingSeek.current = start;
  }, []);

  /* ---- audio element wiring ---------------------------------------- */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaying(false);
    setTime(0);
    setDuration(selected ? selected.durationMs / 1000 : 0);
    if (!selected) {
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    audio.src = selected.url;
    audio.playbackRate = rate;
    audio.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      if (pendingSeek.current !== null) {
        audio.currentTime = Math.min(audio.duration || Infinity, pendingSeek.current);
        setTime(audio.currentTime);
        pendingSeek.current = null;
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setTime(audio.duration || 0);
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Smooth playhead: poll on animation frames while playing, applying the
  // loop region and silence skipping as the time advances.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      let current = audio.currentTime;
      if (loop && current >= loop.b) {
        audio.currentTime = loop.a;
        current = loop.a;
      }
      if (skipSilence && silences?.length) {
        const region = silences.find(
          (item) => current >= item.start && current < item.end,
        );
        if (region && (!loop || region.end < loop.b)) {
          audio.currentTime = region.end;
          current = region.end;
        }
      }
      setTime(current);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, loop, skipSilence, silences]);

  // Decode on demand: waveform peaks when the row has none yet, silences when
  // Skip Silence is switched on.
  useEffect(() => {
    if (!selected) return;
    const needPeaks = !peaks;
    const needSilences = skipSilence && !silences;
    if (!needPeaks && !needSilences) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(selected.url);
        const buffer = await decodeAudio(await response.arrayBuffer());
        if (cancelled) return;
        if (needPeaks) {
          setPeaksById((current) => ({
            ...current,
            [selected.id]: computePeaks(buffer),
          }));
        }
        setSilencesById((current) => ({
          ...current,
          [selected.id]: findSilences(buffer),
        }));
      } catch {
        if (!cancelled && needSilences) {
          setSilencesById((current) => ({ ...current, [selected.id]: [] }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, peaks, silences, skipSilence]);

  /* ---- transport ----------------------------------------------------- */

  const seek = useCallback(
    (next: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const clamped = Math.min(duration || 0, Math.max(0, next));
      audio.currentTime = clamped;
      setTime(clamped);
    },
    [duration],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !selected) return;
    if (audio.paused) {
      if (audio.ended || (duration && audio.currentTime >= duration - 0.05)) {
        audio.currentTime = loop ? loop.a : 0;
      }
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [selected, duration, loop]);

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seek(audio.currentTime + delta);
    },
    [seek],
  );

  function onScrubStart() {
    const audio = audioRef.current;
    resumeAfterScrub.current = Boolean(audio && !audio.paused);
    audio?.pause();
  }

  function onScrubEnd() {
    if (resumeAfterScrub.current) {
      void audioRef.current?.play().catch(() => undefined);
    }
    resumeAfterScrub.current = false;
  }

  function toggleLoop() {
    if (loop) {
      setLoop(null);
      return;
    }
    if (!duration) return;
    const now = audioRef.current?.currentTime ?? time;
    const a = Math.min(now, Math.max(0, duration - 1));
    const b = Math.min(duration, a + Math.max(2, Math.min(10, duration / 4)));
    setLoop({ a, b });
  }

  /* ---- hearts / favorites -------------------------------------------- */

  const toggleHeart = useCallback(() => {
    if (!selected) return;
    const id = selected.id;
    if (isOwner) {
      const next = !selected.favorite;
      setRecordings((current) =>
        current.map((item) => (item.id === id ? { ...item, favorite: next } : item)),
      );
      startTransition(() => {
        void setFavorite(id).catch(() => {
          setRecordings((current) =>
            current.map((item) =>
              item.id === id ? { ...item, favorite: !next } : item,
            ),
          );
        });
      });
      return;
    }
    const wasHearted = hearted.has(id);
    setHearted((current) => {
      const next = new Set(current);
      if (wasHearted) next.delete(id);
      else next.add(id);
      return next;
    });
    setRecordings((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, hearts: Math.max(0, item.hearts + (wasHearted ? -1 : 1)) }
          : item,
      ),
    );
    void fetch("/api/voice-memos/hearts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { hearted?: boolean; hearts?: number };
        if (!response.ok || typeof data.hearts !== "number") throw new Error();
        setHearted((current) => {
          const next = new Set(current);
          if (data.hearted) next.add(id);
          else next.delete(id);
          return next;
        });
        setRecordings((current) =>
          current.map((item) =>
            item.id === id ? { ...item, hearts: data.hearts as number } : item,
          ),
        );
      })
      .catch(() => {
        setHearted((current) => {
          const next = new Set(current);
          if (wasHearted) next.add(id);
          else next.delete(id);
          return next;
        });
        setRecordings((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, hearts: Math.max(0, item.hearts + (wasHearted ? 1 : -1)) }
              : item,
          ),
        );
      });
  }, [selected, isOwner, hearted]);

  /* ---- share ---------------------------------------------------------- */

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  }

  async function copyLink(withTime: boolean) {
    if (!selected) return;
    const url = new URL(`/voice-memos/${selected.slug}`, window.location.origin);
    if (withTime) url.searchParams.set("t", String(Math.floor(time)));
    try {
      await navigator.clipboard.writeText(url.toString());
      flash(withTime ? `Copied link at ${formatClock(time * 1000)}` : "Link copied");
    } catch {
      flash("Could not copy");
    }
    setShareOpen(false);
  }

  /* ---- owner: trash ---------------------------------------------------- */

  function trashSelected() {
    if (!selected || !isOwner) return;
    if (!window.confirm(`Move “${selected.title}” to Recently Deleted?`)) return;
    const id = selected.id;
    const index = visible.findIndex((item) => item.id === id);
    const neighbour = visible[index + 1] ?? visible[index - 1] ?? null;
    setRecordings((current) => current.filter((item) => item.id !== id));
    select(neighbour?.id ?? null);
    startTransition(() => {
      void moveToTrash(id).catch(() => flash("Could not delete"));
    });
  }

  /* ---- keyboard ----------------------------------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey) return;
      switch (event.key) {
        case " ":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          skip(-SKIP_SECONDS);
          break;
        case "ArrowRight":
          event.preventDefault();
          skip(SKIP_SECONDS);
          break;
        case "ArrowUp":
        case "ArrowDown": {
          event.preventDefault();
          if (!visible.length) break;
          const index = visible.findIndex((item) => item.id === selectedId);
          const next =
            event.key === "ArrowDown"
              ? visible[Math.min(visible.length - 1, index + 1)]
              : visible[Math.max(0, index - 1)];
          if (next) select(next.id);
          break;
        }
        case "f":
        case "F":
          toggleHeart();
          break;
        case "l":
        case "L":
          toggleLoop();
          break;
        case "Escape":
          if (panelOpen) {
            setPanelOpen(false);
            break;
          }
          setOptionsOpen(false);
          setShareOpen(false);
          setMobileDetail(false);
          break;
        default:
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  /* ---- notes --------------------------------------------------------- */

  const [noteBody, setNoteBody] = useState("");
  const [noteName, setNoteName] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState("");
  const honeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNoteName(window.localStorage.getItem("clemissima-note-name") ?? "");
  }, []);

  async function postNote(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    try {
      const response = await fetch("/api/voice-memos/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          name: noteName,
          body: noteBody,
          website: honeyRef.current?.value ?? "",
        }),
      });
      const data = (await response.json()) as { note?: RecordingNote | null; error?: string };
      if (!response.ok) {
        setNoteError(data.error ?? "Try again.");
        return;
      }
      if (data.note) {
        setNotes((current) => [...current, data.note as RecordingNote]);
        setRecordings((current) =>
          current.map((item) =>
            item.id === selected.id ? { ...item, noteCount: item.noteCount + 1 } : item,
          ),
        );
      }
      setNoteBody("");
      if (noteName.trim()) {
        window.localStorage.setItem("clemissima-note-name", noteName.trim());
      }
    } catch {
      setNoteError("Try again.");
    } finally {
      setNoteBusy(false);
    }
  }

  function onReplyCreated(reply: RecordingReply) {
    setReplies((current) => [...current, reply]);
    setRecordings((current) =>
      current.map((item) =>
        item.id === reply.recordingId
          ? { ...item, replyCount: item.replyCount + 1 }
          : item,
      ),
    );
  }

  function deleteNoteLocal(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
    startTransition(() => void removeNote(id).catch(() => flash("Could not delete")));
  }

  function deleteReplyLocal(id: string) {
    setReplies((current) => current.filter((reply) => reply.id !== id));
    startTransition(() => void removeReply(id).catch(() => flash("Could not delete")));
  }

  /* ---- render --------------------------------------------------------- */

  const heartActive = selected
    ? isOwner
      ? selected.favorite
      : hearted.has(selected.id)
    : false;

  return (
    <div
      className={`${styles.app}${mobileDetail ? ` ${styles.showDetail}` : ""}`}
      data-owner={isOwner ? "true" : undefined}
    >
      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" />

      <aside className={styles.sidebar} aria-label="Recordings">
        <header className={styles.sidebarHeader}>
          <button
            type="button"
            className={styles.folderToggle}
            onClick={() => setPickingFolder((value) => !value)}
            aria-expanded={pickingFolder}
          >
            <ChevronIcon direction={pickingFolder ? "down" : "left"} size={13} />
            <span>{pickingFolder ? "Folders" : VIEW_LABELS[view]}</span>
          </button>
          <label className={styles.search}>
            <SearchIcon />
            <input
              type="search"
              value={query}
              placeholder="Search"
              aria-label="Search titles"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </header>

        {pickingFolder ? (
          <ul className={styles.folderList}>
            {(["all", "favorites", "stories", "dreams", "notes", "singing"] as RecordingView[]).map(
              (item) => (
                <li key={item}>
                  <button
                    type="button"
                    className={item === view ? styles.folderActive : undefined}
                    onClick={() => {
                      setView(item);
                      setPickingFolder(false);
                    }}
                  >
                    <span>{VIEW_LABELS[item]}</span>
                    <span className={styles.folderCount}>{counts[item]}</span>
                  </button>
                </li>
              ),
            )}
          </ul>
        ) : (
          <ul className={styles.list}>
            {visible.length === 0 ? (
              <li className={styles.empty}>
                {recordings.length ? "No Results" : "check back tomorrow"}
              </li>
            ) : null}
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.row}${item.id === selectedId ? ` ${styles.rowSelected}` : ""}`}
                  onClick={() => select(item.id, { openDetail: true })}
                  aria-current={item.id === selectedId ? "true" : undefined}
                >
                  <span className={styles.rowTitle}>{item.title}</span>
                  <span className={styles.rowMeta}>
                    <span>{formatRecordingDate(item.recordedAt)}</span>
                    {item.noteCount ? (
                      <span className={styles.rowBadge} title={`${item.noteCount} notes`}>
                        <NoteBadgeIcon />
                      </span>
                    ) : null}
                    {item.replyCount ? (
                      <span className={styles.rowBadge} title={`${item.replyCount} voice replies`}>
                        <MicBadgeIcon />
                      </span>
                    ) : null}
                    {item.favorite ? (
                      <span className={styles.rowBadge} title="Favorite">
                        <HeartIcon size={12} filled />
                      </span>
                    ) : null}
                    <span className={styles.rowDuration}>{formatClock(item.durationMs)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={styles.detail} aria-label="Player">
        {selected ? (
          <>
            <div className={styles.toolbar}>
              <button
                type="button"
                className={styles.back}
                onClick={() => setMobileDetail(false)}
                aria-label="Back to recordings"
              >
                <ChevronIcon size={15} />
                <span>{VIEW_LABELS[view]}</span>
              </button>
              <div className={styles.toolGroup}>
                <div className={styles.popWrap}>
                  <button
                    type="button"
                    className={styles.tool}
                    aria-label="Share"
                    aria-expanded={shareOpen}
                    onClick={() => {
                      setShareOpen((value) => !value);
                      setOptionsOpen(false);
                    }}
                  >
                    <ShareIcon />
                  </button>
                  {shareOpen ? (
                    <div className={styles.popover} role="menu">
                      <button type="button" role="menuitem" onClick={() => void copyLink(false)}>
                        Copy Link
                      </button>
                      <button type="button" role="menuitem" onClick={() => void copyLink(true)}>
                        Copy Link at {formatClock(time * 1000)}
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`${styles.tool}${heartActive ? ` ${styles.toolActive}` : ""}`}
                  aria-label={isOwner ? "Favorite" : "Heart this recording"}
                  aria-pressed={heartActive}
                  onClick={toggleHeart}
                >
                  <HeartIcon filled={heartActive} />
                  {selected.hearts ? (
                    <span className={styles.toolCount}>{selected.hearts}</span>
                  ) : null}
                </button>
                {isOwner ? (
                  <button
                    type="button"
                    className={styles.tool}
                    aria-label="Delete"
                    onClick={trashSelected}
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </div>
              <div className={styles.toolGroup}>
                <div className={styles.popWrap}>
                  <button
                    type="button"
                    className={`${styles.tool}${rate !== 1 || skipSilence ? ` ${styles.toolActive}` : ""}`}
                    aria-label="Playback options"
                    aria-expanded={optionsOpen}
                    onClick={() => {
                      setOptionsOpen((value) => !value);
                      setShareOpen(false);
                    }}
                  >
                    <OptionsIcon />
                  </button>
                  {optionsOpen ? (
                    <div className={`${styles.popover} ${styles.options}`}>
                      <div className={styles.optionRow}>
                        <span className={styles.optionLabel}>Playback Speed</span>
                        <span className={styles.optionValue}>{rate}×</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={SPEEDS.length - 1}
                        step={1}
                        value={SPEEDS.indexOf(rate)}
                        aria-label="Playback speed"
                        onChange={(event) => setRate(SPEEDS[Number(event.target.value)])}
                      />
                      <div className={styles.speedScale}>
                        <span>🐢</span>
                        <span>🐇</span>
                      </div>
                      <label className={styles.optionRow}>
                        <span className={styles.optionLabel}>Skip Silence</span>
                        <input
                          type="checkbox"
                          role="switch"
                          className={styles.switch}
                          checked={skipSilence}
                          onChange={(event) => setSkipSilence(event.target.checked)}
                        />
                      </label>
                      <label className={styles.optionRow}>
                        <span className={styles.optionLabel}>Loop Section</span>
                        <input
                          type="checkbox"
                          role="switch"
                          className={styles.switch}
                          checked={Boolean(loop)}
                          onChange={toggleLoop}
                        />
                      </label>
                      {loop ? (
                        <p className={styles.optionHint}>
                          Drag the yellow handles on the overview to set the section.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`${styles.tool}${loop ? ` ${styles.toolActive}` : ""}`}
                  aria-label="Loop section"
                  aria-pressed={Boolean(loop)}
                  onClick={toggleLoop}
                >
                  <LoopIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.tool}${panelOpen ? ` ${styles.toolActive}` : ""}`}
                  aria-label="Notes and voice replies"
                  aria-expanded={panelOpen}
                  onClick={() => {
                    setPanelOpen((value) => !value);
                    setOptionsOpen(false);
                    setShareOpen(false);
                  }}
                >
                  <NoteBadgeIcon size={17} />
                  {selectedNotes.length + selectedReplies.length ? (
                    <span className={styles.toolCount}>
                      {selectedNotes.length + selectedReplies.length}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className={styles.stage}>
              <header className={styles.heading}>
                <h2>{selected.title}</h2>
                <p>
                  <span>{formatRecordingDate(selected.recordedAt)}</span>
                  <span>{formatRecordingTime(selected.recordedAt)}</span>
                  <span className={styles.headingFolder}>{FOLDER_LABELS[selected.folder]}</span>
                </p>
              </header>

              <Waveform
                peaks={peaks}
                duration={duration}
                time={time}
                loop={loop}
                onScrubStart={onScrubStart}
                onScrub={seek}
                onScrubEnd={onScrubEnd}
              />

              <div className={styles.overviewWrap}>
                <Overview
                  peaks={peaks}
                  duration={duration}
                  time={time}
                  loop={loop}
                  onSeek={seek}
                  onLoopChange={setLoop}
                />
                <div className={styles.overviewLabels}>
                  <span>0:00</span>
                  <span>{formatClock(duration * 1000)}</span>
                </div>
              </div>

              <p className={styles.readout} aria-live="off">
                {formatPlayhead(time)}
              </p>

              <div className={styles.transport}>
                <button
                  type="button"
                  className={styles.skip}
                  aria-label="Back 15 seconds"
                  onClick={() => skip(-SKIP_SECONDS)}
                >
                  <Skip15Icon />
                </button>
                <button
                  type="button"
                  className={styles.play}
                  aria-label={playing ? "Pause" : "Play"}
                  onClick={togglePlay}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  type="button"
                  className={styles.skip}
                  aria-label="Forward 15 seconds"
                  onClick={() => skip(SKIP_SECONDS)}
                >
                  <Skip15Icon forward />
                </button>
              </div>

              <div className={styles.compose}>
                <form className={styles.composeNote} onSubmit={(event) => void postNote(event)}>
                  <input
                    value={noteName}
                    maxLength={60}
                    autoComplete="nickname"
                    placeholder="name"
                    aria-label="Name, optional"
                    className={styles.composeName}
                    onChange={(event) => setNoteName(event.target.value)}
                  />
                  <input
                    value={noteBody}
                    maxLength={500}
                    placeholder="leave a note…"
                    aria-label="Leave a note"
                    className={styles.composeBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                  />
                  <input
                    ref={honeyRef}
                    className={styles.honeypot}
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <button
                    type="submit"
                    className={styles.composePost}
                    disabled={noteBusy || noteBody.trim().length < 2}
                  >
                    {noteBusy ? "…" : "Post"}
                  </button>
                </form>
                <ReplyRecorder
                  recordingId={selected.id}
                  name={noteName}
                  onNameChange={setNoteName}
                  onCreated={onReplyCreated}
                  showName={false}
                />
                {noteError ? (
                  <p className={styles.formError} role="status">
                    {noteError}
                  </p>
                ) : null}
                <button
                  type="button"
                  className={styles.composeCount}
                  aria-expanded={panelOpen}
                  onClick={() => setPanelOpen((value) => !value)}
                >
                  {selectedNotes.length + selectedReplies.length
                    ? `${selectedNotes.length} note${selectedNotes.length === 1 ? "" : "s"} · ${selectedReplies.length} voice repl${selectedReplies.length === 1 ? "y" : "ies"}`
                    : "no notes yet"}
                  {panelOpen ? " — hide" : " — read"}
                </button>
              </div>
            </div>

            <aside
              className={`${styles.panel}${panelOpen ? ` ${styles.panelOpen}` : ""}`}
              aria-label="Notes and voice replies"
              aria-hidden={!panelOpen}
            >
              <header className={styles.panelHeader}>
                <h3>Notes & Replies</h3>
                <button
                  type="button"
                  className={styles.panelClose}
                  aria-label="Close"
                  onClick={() => setPanelOpen(false)}
                >
                  <CloseIcon size={12} />
                </button>
              </header>
              <div className={styles.panelBody}>
              <section className={styles.notes} aria-label="Notes">
                <h3>
                  Notes
                  {selectedNotes.length ? <span>{selectedNotes.length}</span> : null}
                </h3>
                {selectedNotes.length ? (
                  <ul className={styles.noteList}>
                    {selectedNotes.map((note) => (
                      <li key={note.id}>
                        <p className={styles.noteMeta}>
                          <strong>{note.name ?? "someone"}</strong>
                          <span>{formatRecordingDate(note.createdAt)}</span>
                          {isOwner ? (
                            <button
                              type="button"
                              className={styles.remove}
                              aria-label="Delete note"
                              onClick={() => deleteNoteLocal(note.id)}
                            >
                              <CloseIcon size={11} />
                            </button>
                          ) : null}
                        </p>
                        <p className={styles.noteBody}>{note.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!selectedNotes.length ? (
                  <p className={styles.panelEmpty}>No notes yet — yours would be the first.</p>
                ) : null}
              </section>

              <section className={styles.replies} aria-label="Voice replies">
                <h3>
                  Voice Replies
                  {selectedReplies.length ? <span>{selectedReplies.length}</span> : null}
                </h3>
                {selectedReplies.length ? (
                  <ul className={styles.replyList}>
                    {selectedReplies.map((reply) => (
                      <li key={reply.id}>
                        <ReplyRow
                          reply={reply}
                          onDelete={isOwner ? () => deleteReplyLocal(reply.id) : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!selectedReplies.length ? (
                  <p className={styles.panelEmpty}>No voice replies yet.</p>
                ) : null}
              </section>
              </div>
            </aside>
          </>
        ) : (
          <div className={styles.blank}>
            <p>{recordings.length ? "Select a recording" : "check back tomorrow"}</p>
          </div>
        )}
      </section>

      {toast ? (
        <div className={styles.toast} role="status">
          <CheckIcon /> {toast}
        </div>
      ) : null}
    </div>
  );
}

function ReplyRow({
  reply,
  onDelete,
}: {
  reply: RecordingReply;
  onDelete?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }

  return (
    <div className={styles.reply}>
      <audio
        ref={audioRef}
        src={reply.url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
        }}
      />
      <button
        type="button"
        className={styles.replyPlay}
        aria-label={playing ? "Pause reply" : "Play reply"}
        onClick={toggle}
      >
        {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>
      <span className={styles.replyBar} aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </span>
      <span className={styles.replyMeta}>
        <strong>{reply.name ?? "someone"}</strong>
        <span>{formatClock(reply.durationMs)}</span>
      </span>
      {onDelete ? (
        <button
          type="button"
          className={styles.remove}
          aria-label="Delete reply"
          onClick={onDelete}
        >
          <CloseIcon size={11} />
        </button>
      ) : null}
    </div>
  );
}
