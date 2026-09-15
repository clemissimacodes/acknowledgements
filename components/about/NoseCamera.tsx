"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./NoseCamera.module.css";

const SOURCE_SIZE = 640;
const DEFAULT_ZOOM = 3.4;

export function NoseCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<
    { x: number; y: number; offsetX: number; offsetY: number } | undefined
  >(undefined);
  const [active, setActive] = useState(false);
  const [sourcePhoto, setSourcePhoto] = useState("");
  const [photo, setPhoto] = useState("");
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
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
    setSourcePhoto("");
    setPhoto("");
    setZoom(DEFAULT_ZOOM);
    setOffset({ x: 0, y: 0 });
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
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = (video.videoWidth - side) / 2;
    const sourceY = (video.videoHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = SOURCE_SIZE;
    canvas.height = SOURCE_SIZE;
    const context = canvas.getContext("2d");
    context?.translate(SOURCE_SIZE, 0);
    context?.scale(-1, 1);
    context?.drawImage(
      video,
      sourceX,
      sourceY,
      side,
      side,
      0,
      0,
      SOURCE_SIZE,
      SOURCE_SIZE,
    );
    sourceCanvasRef.current = canvas;
    setSourcePhoto(canvas.toDataURL("image/jpeg", 0.72));
    stopCamera();
  }

  function cropPhoto() {
    const source = sourceCanvasRef.current;
    if (!source) return;
    const cropSide = SOURCE_SIZE / zoom;
    const sourceX = Math.max(
      0,
      Math.min(
        SOURCE_SIZE - cropSide,
        SOURCE_SIZE / 2 - (offset.x * SOURCE_SIZE) / zoom - cropSide / 2,
      ),
    );
    const sourceY = Math.max(
      0,
      Math.min(
        SOURCE_SIZE - cropSide,
        SOURCE_SIZE / 2 - (offset.y * SOURCE_SIZE) / zoom - cropSide / 2,
      ),
    );
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    canvas
      .getContext("2d")
      ?.drawImage(source, sourceX, sourceY, cropSide, cropSide, 0, 0, 320, 320);
    setPhoto(canvas.toDataURL("image/jpeg", 0.68));
  }

  function moveCrop(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const width = cropRef.current?.clientWidth;
    if (!drag || !width) return;
    const maximum = (zoom - 1) / 2;
    setOffset({
      x: Math.max(
        -maximum,
        Math.min(maximum, drag.offsetX + (event.clientX - drag.x) / width),
      ),
      y: Math.max(
        -maximum,
        Math.min(maximum, drag.offsetY + (event.clientY - drag.y) / width),
      ),
    });
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend>nosiness requires nose evidence</legend>
      <input type="hidden" name="nosePhoto" value={photo} />
      <div
        className={`${styles.camera}${sourcePhoto && !photo ? ` ${styles.cropper}` : ""}`}
        ref={cropRef}
        role={sourcePhoto && !photo ? "img" : undefined}
        aria-label={sourcePhoto && !photo ? "Draggable circular nose crop" : undefined}
        tabIndex={sourcePhoto && !photo ? 0 : undefined}
        onPointerDown={(event) => {
          if (!sourcePhoto || photo) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            offsetX: offset.x,
            offsetY: offset.y,
          };
        }}
        onPointerMove={moveCrop}
        onPointerUp={() => {
          dragRef.current = undefined;
        }}
        onKeyDown={(event) => {
          if (!sourcePhoto || photo) return;
          const amount = 0.03;
          const maximum = (zoom - 1) / 2;
          const next = { ...offset };
          if (event.key === "ArrowLeft") next.x += amount;
          else if (event.key === "ArrowRight") next.x -= amount;
          else if (event.key === "ArrowUp") next.y += amount;
          else if (event.key === "ArrowDown") next.y -= amount;
          else return;
          event.preventDefault();
          setOffset({
            x: Math.max(-maximum, Math.min(maximum, next.x)),
            y: Math.max(-maximum, Math.min(maximum, next.y)),
          });
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Your captured nose" />
        ) : sourcePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sourcePhoto}
            alt=""
            draggable={false}
            style={{
              transform: `translate(${offset.x * 100}%, ${offset.y * 100}%) scale(${zoom})`,
            }}
          />
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

      {sourcePhoto && !photo ? (
        <div className={styles.cropControls}>
          <span>drag until it is nothing but nose</span>
          <label>
            zoom
            <input
              type="range"
              min="2.8"
              max="5"
              step="0.1"
              value={zoom}
              onChange={(event) => {
                const nextZoom = Number(event.target.value);
                const maximum = (nextZoom - 1) / 2;
                setZoom(nextZoom);
                setOffset((current) => ({
                  x: Math.max(-maximum, Math.min(maximum, current.x)),
                  y: Math.max(-maximum, Math.min(maximum, current.y)),
                }));
              }}
            />
          </label>
          <button type="button" onClick={cropPhoto}>
            crop my nose
          </button>
        </div>
      ) : null}

      <div className={styles.actions}>
        {active ? (
          <button type="button" onClick={capture}>
            take nose pic
          </button>
        ) : !sourcePhoto || photo ? (
          <button type="button" onClick={() => void startCamera()}>
            {photo ? "retake nose" : "open nose cam"}
          </button>
        ) : null}
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
                setSourcePhoto("");
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
