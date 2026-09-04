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

const CHANGE_INTERVAL = 8_000;

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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const changePose = () => {
      if (loading || reducedMotion.matches) return;
      loading = true;
      const next = pickNextPose(currentPose.current);
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
      };
      image.onerror = () => {
        loading = false;
      };
      image.src = nextPose.src;
    };

    const scheduleChange = () => {
      window.clearTimeout(timeoutId);
      if (reducedMotion.matches) return;
      timeoutId = window.setTimeout(() => {
        if (document.visibilityState === "visible") changePose();
        scheduleChange();
      }, CHANGE_INTERVAL);
    };

    const changeAfterReturning = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastChange >= CHANGE_INTERVAL
      ) {
        changePose();
        scheduleChange();
      } else if (document.visibilityState === "hidden") {
        window.clearTimeout(timeoutId);
      }
    };

    const handleMotionPreference = () => {
      window.clearTimeout(timeoutId);
      if (!reducedMotion.matches) scheduleChange();
    };

    scheduleChange();
    document.addEventListener("visibilitychange", changeAfterReturning);
    window.addEventListener("pageshow", changeAfterReturning);
    reducedMotion.addEventListener("change", handleMotionPreference);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", changeAfterReturning);
      window.removeEventListener("pageshow", changeAfterReturning);
      reducedMotion.removeEventListener("change", handleMotionPreference);
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
