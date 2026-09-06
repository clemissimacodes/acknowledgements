"use client";

import { useEffect, useRef, useState } from "react";

const POSES = [
  { id: "still", src: "/clemi/still.png" },
  { id: "blep", src: "/clemi/blep.png" },
  { id: "smile", src: "/clemi/smile.png" },
  { id: "wink", src: "/clemi/wink.png" },
  { id: "eyes-closed", src: "/clemi/eyes-closed.png" },
  { id: "eyes-left", src: "/clemi/eyes-left.png" },
  { id: "eyes-up", src: "/clemi/eyes-up.png" },
  { id: "ear-flop", src: "/clemi/ear-flop.png" },
  { id: "fangs", src: "/clemi/fangs.png" },
  { id: "puff", src: "/clemi/puff.png" },
  { id: "fist", src: "/clemi/fist.png" },
  { id: "peace", src: "/clemi/peace.png" },
  { id: "raspberry", src: "/clemi/raspberry.png" },
  { id: "shush", src: "/clemi/shush.png" },
  { id: "pigeon-toe", src: "/clemi/pigeon-toe.png" },
] as const;

type PoseId = (typeof POSES)[number]["id"];

const STORAGE_KEY = "clemi-pose";
const CHANGE_INTERVAL = 8_000;

function isPoseId(value: string | null): value is PoseId {
  return POSES.some((pose) => pose.id === value);
}

function pickNextPose(current: PoseId): PoseId {
  const choices = POSES.filter((pose) => pose.id !== current);
  return choices[Math.floor(Math.random() * choices.length)]?.id ?? "still";
}

export function Clemi() {
  const [poseId, setPoseId] = useState<PoseId>("still");
  const currentPose = useRef<PoseId>("still");

  useEffect(() => {
    let timeoutId: number | undefined;
    let lastChange = Date.now();
    let loading = false;
    let cancelled = false;

    const changePose = () => {
      if (loading) return;
      loading = true;
      let previous = currentPose.current;

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isPoseId(stored)) previous = stored;
      } catch {
        // Persistence is optional.
      }

      const next = pickNextPose(previous);
      const nextPose = POSES.find((pose) => pose.id === next);
      if (!nextPose) {
        loading = false;
        return;
      }

      const image = new Image();
      image.onload = () => {
        loading = false;
        if (cancelled) return;
        currentPose.current = next;
        lastChange = Date.now();
        setPoseId(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Persistence is optional.
        }
      };
      image.onerror = () => {
        loading = false;
      };
      image.src = nextPose.src;
    };

    const scheduleChange = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        if (document.visibilityState === "visible") changePose();
        scheduleChange();
      }, CHANGE_INTERVAL);
    };

    const changeAfterReturning = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastChange > 500
      ) {
        changePose();
        scheduleChange();
      } else if (document.visibilityState === "hidden") {
        window.clearTimeout(timeoutId);
      }
    };

    changePose();
    scheduleChange();
    document.addEventListener("visibilitychange", changeAfterReturning);
    window.addEventListener("pageshow", changeAfterReturning);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", changeAfterReturning);
      window.removeEventListener("pageshow", changeAfterReturning);
    };
  }, []);

  const pose = POSES.find((item) => item.id === poseId) ?? POSES[0];

  return (
    <img
      className="index-portrait"
      src={pose.src}
      alt="A drawing of Clementine in a clementine hood with rabbit ears"
      data-pose={pose.id}
    />
  );
}
