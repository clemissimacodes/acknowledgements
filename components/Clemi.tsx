"use client";

import { useEffect, useRef, useState } from "react";

const POSES = [
  { id: "still", src: "/clemi/still.png" },
  { id: "blep", src: "/clemi/blep.png" },
  { id: "smile", src: "/clemi/smile.png" },
  { id: "eyes-left", src: "/clemi/eyes-left.png" },
  { id: "eye-roll", src: "/clemi/eye-roll.png" },
  { id: "ear-flop", src: "/clemi/ear-flop.png" },
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
    let lastChange = 0;

    const changePose = () => {
      let previous = currentPose.current;

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isPoseId(stored)) previous = stored;
      } catch {
        // Clemi still moves when storage is unavailable.
      }

      const next = pickNextPose(previous);
      currentPose.current = next;
      lastChange = Date.now();
      setPoseId(next);

      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Persisting the pose is optional.
      }
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

    POSES.forEach(({ src }) => {
      const image = new Image();
      image.src = src;
    });

    changePose();
    scheduleChange();
    document.addEventListener("visibilitychange", changeAfterReturning);
    window.addEventListener("pageshow", changeAfterReturning);

    return () => {
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
