"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./NoseCamera.module.css";

export function NoseCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [photo, setPhoto] = useState("");
  const [noseShy, setNoseShy] = useState(false);
  const [error, setError] = useState("");

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }

  useEffect(() => stopCamera, []);

  async function startCamera() {
    setError("");
    setNoseShy(false);
    setPhoto("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch {
      setError("the nose cam is feeling shy too");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    const side = Math.min(video.videoWidth, video.videoHeight) * 0.38;
    const sourceX = (video.videoWidth - side) / 2;
    const sourceY = (video.videoHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    const context = canvas.getContext("2d");
    context?.translate(320, 0);
    context?.scale(-1, 1);
    context?.drawImage(video, sourceX, sourceY, side, side, 0, 0, 320, 320);
    setPhoto(canvas.toDataURL("image/jpeg", 0.64));
    stopCamera();
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend>nose evidence</legend>
      <p className={styles.instruction}>nose only. no eyes. no alibis.</p>
      <input type="hidden" name="nosePhoto" value={photo} />
      <div className={styles.camera}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Your captured nose" />
        ) : (
          <video
            ref={videoRef}
            className={active ? styles.active : ""}
            muted
            playsInline
            aria-label="Live nose camera"
          />
        )}
      </div>

      <div className={styles.actions}>
        {active ? (
          <button type="button" onClick={capture}>
            take nose pic
          </button>
        ) : (
          <button type="button" onClick={() => void startCamera()}>
            {photo ? "retake nose" : "open nose cam"}
          </button>
        )}
        <label>
          <input
            type="checkbox"
            name="noseShy"
            value="yes"
            checked={noseShy}
            onChange={(event) => {
              const checked = event.target.checked;
              setNoseShy(checked);
              if (checked) {
                setPhoto("");
                stopCamera();
              }
            }}
          />
          <span>i am nose shy</span>
        </label>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </fieldset>
  );
}
