"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { NoseDoodle } from "./NoseDoodle";
import styles from "./NoseCamera.module.css";

const SOURCE_SIZE = 640;
const DEFAULT_ZOOM = 3.4;

function renderCrop(
  source: HTMLCanvasElement,
  zoom: number,
  offset: { x: number; y: number },
) {
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
  return canvas.toDataURL("image/jpeg", 0.68);
}

export function NoseCamera({
  onValidityChange,
  onDrawingModeChange,
}: {
  onValidityChange: (valid: boolean) => void;
  onDrawingModeChange: (drawing: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<
    { x: number; y: number; offsetX: number; offsetY: number } | undefined
  >(undefined);
  const [active, setActive] = useState(false);
  const [editing, setEditing] = useState(false);
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
  useEffect(() => {
    onValidityChange(Boolean(photo));
  }, [onValidityChange, photo]);
  useEffect(() => {
    onDrawingModeChange(noseShy);
    return () => onDrawingModeChange(false);
  }, [noseShy, onDrawingModeChange]);
  useEffect(() => {
    const source = sourceCanvasRef.current;
    if (editing && source) setPhoto(renderCrop(source, zoom, offset));
  }, [editing, offset, zoom]);
  useEffect(
    () => () => {
      onValidityChange(false);
    },
    [onValidityChange],
  );

  async function startCamera() {
    setError("");
    setNoseShy(false);
    setSourcePhoto("");
    setPhoto("");
    setEditing(false);
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
    setPhoto(renderCrop(canvas, DEFAULT_ZOOM, { x: 0, y: 0 }));
    setEditing(true);
    stopCamera();
  }

  function cropPhoto() {
    setEditing(false);
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
      {noseShy ? (
        <NoseDoodle onChange={setPhoto} />
      ) : (
        <>
          <div
        className={`${styles.camera}${editing ? ` ${styles.cropper}` : ""}`}
        ref={cropRef}
        role={editing ? "img" : undefined}
        aria-label={editing ? "Draggable circular nose crop" : undefined}
        tabIndex={editing ? 0 : undefined}
        onPointerDown={(event) => {
          if (!editing) return;
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
          if (!editing) return;
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
        {editing && sourcePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sourcePhoto}
            alt=""
            draggable={false}
            style={{
              transform: `translate(${offset.x * 100}%, ${offset.y * 100}%) scale(${zoom})`,
            }}
          />
        ) : photo ? (
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

          {editing ? (
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
        </>
      )}

      <div className={styles.actions}>
        {!noseShy && active ? (
          <button type="button" onClick={capture}>
            take nose pic
          </button>
        ) : !noseShy && (!sourcePhoto || !editing) ? (
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
              setEditing(false);
              setSourcePhoto("");
              setPhoto("");
              stopCamera();
            }}
          />
          <span>i am nose shy (i’ll draw it)</span>
        </label>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </fieldset>
  );
}
