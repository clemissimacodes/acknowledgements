import { IMAGE_SLOTS, type ImageSlot } from "@/lib/friend-types";

/* Browser-only. Crops an image to the slot's aspect ratio (cover, anchored like the
   shop's object-position), scales it to at most the slot's pixel size, and returns
   a PNG when the source has transparency (cutouts) or a JPEG otherwise. */
export async function cropToSlot(file: File, slot: ImageSlot): Promise<File> {
  const spec = IMAGE_SLOTS[slot];
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const sw = bitmap.width;
    const sh = bitmap.height;
    const target = spec.width / spec.height;
    const source = sw / sh;

    /* Cover: keep the full short side, trim the long one. */
    let cw = sw;
    let ch = sh;
    if (source > target) cw = Math.round(sh * target);
    else ch = Math.round(sw / target);
    const cx = Math.round((sw - cw) / 2);
    const cy = spec.anchor === "bottom" ? sh - ch : Math.round((sh - ch) / 2);

    /* Never upscale: a small photo stays small, just at the right ratio. */
    const scale = Math.min(1, spec.width / cw);
    const ow = Math.max(1, Math.round(cw * scale));
    const oh = Math.max(1, Math.round(ch * scale));

    const canvas = document.createElement("canvas");
    canvas.width = ow;
    canvas.height = oh;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Couldn't prepare the image.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, cx, cy, cw, ch, 0, 0, ow, oh);

    const transparent = hasTransparency(ctx, ow, oh);
    const type = transparent ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    if (!blob) throw new Error("Couldn't encode the image.");
    const base = file.name.replace(/\.[a-z0-9]+$/i, "") || slot;
    return new File([blob], `${base}.${transparent ? "png" : "jpg"}`, { type, lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

/* Sample a coarse grid; any see-through pixel means keep PNG. */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const step = Math.max(1, Math.floor(Math.min(w, h) / 48));
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] < 250) return true;
    }
  }
  return false;
}
