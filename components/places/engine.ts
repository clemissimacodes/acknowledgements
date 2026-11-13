import { splitPlaceName, type Place } from "@/lib/place-types";
import {
  WORLD_BOTTOM,
  WORLD_TOP,
  WORLD_WIDTH,
  buildWorld,
  countryAt,
  greatCircle,
  latitudeAt,
  worldY,
  wrapLongitude,
  type Country,
  type Point,
  type World,
} from "./atlas";
import { drawJet } from "./jet";

// The Places map, drawn by hand on two stacked canvases: the paper and land
// underneath (redrawn only when the view moves), and the threads, tokens and
// jet on top (redrawn every frame so they can breathe).

export type Insets = { top: number; right: number; bottom: number; left: number };
export type Spot = { lat: number; lng: number };

export type AtlasEvents = {
  onSelect(id: string | null): void;
  onPin(spot: Spot): void;
};

const TAU = Math.PI * 2;
const STEPS = 72;
const ROUTE_STEPS = 56;
const MAX_ZOOM = 48;
const SPECKLE_TILE = 220;
const IRIDESCENT = ["#f7b9d6", "#b4ebf3", "#c9c1f7", "#fbeab8", "#b3efd4", "#f7b9d6"];

const ENVELOPE = Float32Array.from({ length: STEPS + 1 }, (_, index) =>
  Math.pow(Math.sin((Math.PI * index) / STEPS), 0.75),
);

type Tones = ReturnType<typeof tonesFor>;

/** Everything on the map takes its colour from the ground it sits on. */
function tonesFor(ground: string) {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  let dark = false;
  if (ctx) {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
  }
  return dark
    ? {
        dark,
        ground,
        speck: "rgba(190, 210, 230, 0.2)",
        grid: "rgba(170, 190, 215, 0.09)",
        gridMark: "rgba(170, 190, 215, 0.3)",
        land: "rgba(150, 172, 200, 0.13)",
        border: "rgba(170, 190, 215, 0.16)",
        coast: "rgba(186, 204, 226, 0.5)",
        visited: "rgba(132, 208, 234, 0.3)",
        visitedEdge: "rgba(150, 220, 242, 0.85)",
        halo: "rgba(132, 208, 234, 0.6)",
        threads: ["#c9d2dc", "#e3e8ee", "#aab5c2", "#f2f5f8", "#bcc6d1"],
        bead: "#ffffff",
        beadEdge: "rgba(210, 220, 232, 0.6)",
        ink: "#f1f3f5",
        aquaCore: "#d9f5fc",
        aquaEdge: "#8fd8ee",
        aquaGlow: "126, 208, 234",
        cobalt: "#2f55e6",
        cobaltLight: "#7f9bff",
        cobaltDeep: "#1736b0",
        cobaltGlow: "70, 110, 255",
        pearlEdge: "rgba(220, 228, 238, 0.7)",
        pearlShadow: "rgba(0, 0, 0, 0.4)",
      }
    : {
        dark,
        ground,
        speck: "rgba(84, 102, 122, 0.3)",
        grid: "rgba(104, 124, 146, 0.1)",
        gridMark: "rgba(104, 124, 146, 0.36)",
        land: "#e6eaeb",
        border: "rgba(132, 148, 164, 0.3)",
        coast: "rgba(126, 142, 158, 0.62)",
        visited: "#cdeaf4",
        visitedEdge: "#7fc3db",
        halo: "rgba(110, 190, 218, 0.8)",
        threads: ["#8b97a4", "#a9b3bd", "#c2c9d0", "#98a3af", "#b4bdc6"],
        bead: "#ffffff",
        beadEdge: "rgba(112, 126, 142, 0.85)",
        ink: "#161412",
        aquaCore: "#c4ebf6",
        aquaEdge: "#4eaecf",
        aquaGlow: "104, 198, 228",
        cobalt: "#1736b0",
        cobaltLight: "#4a6bea",
        cobaltDeep: "#0c2280",
        cobaltGlow: "23, 54, 176",
        pearlEdge: "rgba(132, 144, 158, 0.8)",
        pearlShadow: "rgba(70, 84, 104, 0.3)",
      };
}

function seeded(text: string) {
  let state = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    state = Math.imul(state ^ text.charCodeAt(index), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const mod = (value: number, size: number) => ((value % size) + size) % size;

type Strand = {
  spread: number;
  tone: number;
  f1: number;
  f2: number;
  p1: number;
  p2: number;
  w1: number;
  w2: number;
  beads: number[];
  pace: number;
};

type Thread = {
  points: Float32Array;
  normals: Float32Array;
  length: number;
  left: number;
  right: number;
  duration: number;
  strands: Strand[];
};

type Dot = {
  place: Place;
  title: string;
  x: number;
  y: number;
  phase: number;
  born: number;
  thread: Thread | null;
  label: number;
};

type Mark = { dot: Dot; x: number; y: number };

type Camera = { x: number; y: number; k: number };

type Flight = {
  from: Camera;
  to: Camera;
  dip: number;
  start: number;
  duration: number;
};

type Route = { points: Point[]; start: number; duration: number; ease: (t: number) => number };

function buildThread(home: Dot, dot: Dot): Thread {
  const path = greatCircle(home.place, dot.place, STEPS, home.x);
  const points = new Float32Array((STEPS + 1) * 2);
  const normals = new Float32Array((STEPS + 1) * 2);
  let length = 0;
  let left = Infinity;
  let right = -Infinity;
  path.forEach(([x, y], index) => {
    points[index * 2] = x;
    points[index * 2 + 1] = y;
    if (x < left) left = x;
    if (x > right) right = x;
    if (index) length += Math.hypot(x - path[index - 1][0], y - path[index - 1][1]);
  });
  for (let index = 0; index <= STEPS; index += 1) {
    const before = path[Math.max(0, index - 1)];
    const after = path[Math.min(STEPS, index + 1)];
    const dx = after[0] - before[0];
    const dy = after[1] - before[1];
    const size = Math.hypot(dx, dy) || 1;
    normals[index * 2] = -dy / size;
    normals[index * 2 + 1] = dx / size;
  }
  const random = seeded(dot.place.id);
  const spreads = [-1, -0.46, 0.08, 0.52, 1];
  const strands = spreads.map((spread, tone) => ({
    spread: spread + (random() - 0.5) * 0.3,
    tone,
    f1: 0.7 + random() * 0.9,
    f2: 1.9 + random() * 1.6,
    p1: random() * TAU,
    p2: random() * TAU,
    w1: 0.00016 + random() * 0.00022,
    w2: 0.00022 + random() * 0.0003,
    beads: tone % 2 ? [random()] : [random(), random()],
    pace: 0.000018 + random() * 0.000022,
  }));
  return {
    points,
    normals,
    length,
    left: left - 5,
    right: right + 5,
    duration: 760 + length * 4.5,
    strands,
  };
}

export class Atlas {
  private baseCtx: CanvasRenderingContext2D;
  private topCtx: CanvasRenderingContext2D;
  private tones: Tones;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private cam: Camera = { x: 0, y: 0, k: 1 };
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private flight: Flight | null = null;
  private zoomGoal: { k: number; px: number; py: number } | null = null;
  private glide = { vx: 0, vy: 0 };
  private pristine = true;

  private world: World | null = null;
  private landAlpha = 0;
  private dots: Dot[] = [];
  private home: Dot | null = null;
  private visited: Country[] = [];
  private marks: Mark[] = [];
  private selected: string | null = null;
  private hover: string | null = null;
  private pin: (Spot & { x: number; y: number }) | null = null;
  private pinMode = false;

  private jet = {
    shown: false,
    x: 0,
    y: 0,
    angle: -0.1,
    facing: 1 as 1 | -1,
    thrust: 0,
    park: 1,
    route: null as Route | null,
  };
  private trail: Array<{ x: number; y: number; at: number }> = [];
  private sparks: Array<{ x: number; y: number; vx: number; vy: number; at: number; hue: number }> = [];
  private mini: HTMLImageElement | null = null;

  private clock = 0;
  private last = 0;
  private frame = 0;
  private drawn = 0;
  private baseDirty = true;
  private topDirty = true;
  private still: boolean;
  private font = "serif";
  private speckle: CanvasPattern | null = null;
  private haloDense: CanvasPattern | null = null;
  private haloSparse: CanvasPattern | null = null;
  private scratchX = new Float32Array(STEPS + 2);
  private scratchY = new Float32Array(STEPS + 2);

  private pointers = new Map<number, { x: number; y: number }>();
  private press: { x: number; y: number; at: number; moved: boolean } | null = null;
  private lastMove = { x: 0, y: 0, at: 0 };
  private lastTap = { x: 0, y: 0, at: 0 };
  private pinchStart = 1;
  private observer: ResizeObserver;
  private motion: MediaQueryList;
  private cleanups: Array<() => void> = [];

  constructor(
    private host: HTMLElement,
    private base: HTMLCanvasElement,
    private top: HTMLCanvasElement,
    private events: AtlasEvents,
    ground: string,
  ) {
    this.baseCtx = base.getContext("2d", { alpha: false })!;
    this.topCtx = top.getContext("2d")!;
    this.tones = tonesFor(ground);
    this.font = getComputedStyle(host).fontFamily || "serif";
    this.motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.still = this.motion.matches;

    const mini = new Image();
    mini.onload = () => (this.topDirty = true);
    mini.src = "/clemi/mini.png";
    this.mini = mini;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.listen();
    document.fonts?.ready.then(() => (this.topDirty = true)).catch(() => {});
    this.frame = requestAnimationFrame(this.tick);
  }

  get dark() {
    return this.tones.dark;
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.cleanups.forEach((cleanup) => cleanup());
  }

  // —— What the page tells the map ——

  setWorld(raw: Parameters<typeof buildWorld>[0]) {
    this.world = buildWorld(raw);
    if (this.still) this.landAlpha = 1;
    this.markVisited();
    this.baseDirty = true;
  }

  countryName(spot: Spot) {
    return this.world ? (countryAt(this.world, spot.lat, spot.lng)?.name ?? "") : "";
  }

  setPlaces(places: Place[]) {
    const known = new Map(this.dots.map((dot) => [dot.place.id, dot]));
    const first = this.dots.length === 0;
    const dots = places.map((place, index): Dot => {
      const old = known.get(place.id);
      return {
        place,
        title: splitPlaceName(place.name).title,
        x: wrapLongitude(place.lng),
        y: worldY(place.lat),
        phase: seeded(place.id)() * TAU,
        born: old ? old.born : this.clock + (first ? 380 + index * 60 : 0),
        thread: null,
        label: old?.label ?? 0,
      };
    });
    const home =
      dots.find((dot) => dot.place.kind === "hometown") ??
      dots.find((dot) => dot.place.kind === "current") ??
      dots[0] ??
      null;
    if (home) {
      for (const dot of dots) {
        if (dot !== home) dot.thread = buildThread(home, dot);
      }
    }
    this.dots = dots;
    this.home = home;
    this.markVisited();
    if (this.pristine) this.overview(false);
    if (!this.jet.shown) this.arrive();
    this.baseDirty = true;
    this.topDirty = true;
  }

  setInsets(insets: Insets) {
    this.insets = insets;
    if (this.pristine) this.overview(false);
  }

  /** Marks a place as chosen and flies there, or lets go of the choice. */
  focus(id: string | null) {
    this.selected = id;
    this.topDirty = true;
    const dot = id ? this.dots.find((entry) => entry.place.id === id) : null;
    if (!dot) return;
    this.travel(dot.place, Math.max(this.cam.k, this.closeUp()));
  }

  setPinMode(on: boolean) {
    this.pinMode = on;
    if (!on) this.pin = null;
    this.host.style.cursor = on ? "crosshair" : "grab";
    this.topDirty = true;
  }

  setPin(spot: Spot | null, fly: boolean) {
    this.pin = spot ? { ...spot, x: wrapLongitude(spot.lng), y: worldY(spot.lat) } : null;
    this.topDirty = true;
    if (spot && fly) this.travel(spot, Math.max(this.cam.k, this.closeUp()));
    else if (spot) this.sendJet(spot, this.nearestCopy(wrapLongitude(spot.lng)), 900);
  }

  zoomBy(factor: number) {
    this.stopMoving();
    const focus = this.focusPoint();
    const from = this.zoomGoal?.k ?? this.cam.k;
    this.zoomGoal = { k: this.limitZoom(from * factor), px: focus.x, py: focus.y };
    this.pristine = false;
  }

  resetView() {
    this.pristine = true;
    this.overview(true);
  }

  // —— View ——

  private resize() {
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    if (width === this.width && height === this.height && ratio === this.ratio) return;
    this.width = width;
    this.height = height;
    this.ratio = ratio;
    for (const canvas of [this.base, this.top]) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    this.makePatterns();
    if (this.pristine) this.overview(false);
    else this.settle(this.cam);
    this.baseDirty = true;
    this.topDirty = true;
  }

  private minZoom() {
    return this.width / WORLD_WIDTH;
  }

  private limitZoom(k: number) {
    return clamp(k, this.minZoom(), MAX_ZOOM);
  }

  private closeUp() {
    return clamp(this.width / 30, 13, 20);
  }

  /** Keeps the map sheet from drifting off the paper. */
  private settle(cam: Camera) {
    cam.k = this.limitZoom(cam.k);
    const half = this.height / (2 * cam.k);
    const top = WORLD_TOP - 6;
    const bottom = WORLD_BOTTOM + 6;
    const low = Math.min(top + half, bottom - half);
    const high = Math.max(top + half, bottom - half);
    cam.y = clamp(cam.y, low, high);
    return cam;
  }

  private focusPoint() {
    const { top, right, bottom, left } = this.insets;
    return {
      x: left + Math.max(40, this.width - left - right) / 2,
      y: top + Math.max(40, this.height - top - bottom) / 2,
    };
  }

  private overviewCamera(): Camera {
    const home = this.home;
    if (!home) return this.settle({ x: 0, y: -20, k: this.minZoom() });
    let left = home.x;
    let right = home.x;
    let top = home.y;
    let bottom = home.y;
    for (const dot of this.dots) {
      const points = dot.thread?.points;
      if (!points) continue;
      for (let index = 0; index < points.length; index += 2) {
        if (points[index] < left) left = points[index];
        if (points[index] > right) right = points[index];
        if (points[index + 1] < top) top = points[index + 1];
        if (points[index + 1] > bottom) bottom = points[index + 1];
      }
    }
    const narrow = this.width < 720;
    const sides = narrow ? 26 : 84;
    const roomX = Math.max(80, this.width - this.insets.left - this.insets.right - sides * 2);
    const roomY = Math.max(80, this.height - this.insets.top - this.insets.bottom - 36);
    const k = this.limitZoom(
      Math.min(roomX / Math.max(right - left, 24), roomY / Math.max(bottom - top, 24), 9),
    );
    const focus = this.focusPoint();
    return this.settle({
      x: (left + right) / 2 - (focus.x - this.width / 2) / k,
      y: (top + bottom) / 2 - (focus.y - this.height / 2) / k,
      k,
    });
  }

  private overview(animate: boolean) {
    if (!this.width) return;
    const to = this.overviewCamera();
    this.zoomGoal = null;
    this.glide.vx = this.glide.vy = 0;
    if (animate && !this.still) {
      // Home may be a whole turn of the world away from where she panned to.
      to.x += WORLD_WIDTH * Math.round((this.cam.x - to.x) / WORLD_WIDTH);
      this.flight = { from: { ...this.cam }, to, dip: 0, start: this.clock, duration: 900 };
    } else {
      this.flight = null;
      this.cam = to;
    }
    this.baseDirty = true;
    this.topDirty = true;
  }

  private nearestCopy(x: number) {
    const focus = this.focusPoint();
    const centre = this.cam.x + (focus.x - this.width / 2) / this.cam.k;
    return x + WORLD_WIDTH * Math.round((centre - x) / WORLD_WIDTH);
  }

  private stopMoving() {
    this.flight = null;
    this.glide.vx = this.glide.vy = 0;
  }

  /** Camera and jet leave together and land together. */
  private travel(spot: Spot, k: number) {
    const x = this.nearestCopy(wrapLongitude(spot.lng));
    const y = worldY(spot.lat);
    const focus = this.focusPoint();
    const zoom = this.limitZoom(k);
    const to = this.settle({
      x: x - (focus.x - this.width / 2) / zoom,
      y: y - (focus.y - this.height / 2) / zoom,
      k: zoom,
    });
    const from = { ...this.cam };
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const pixels = span * Math.min(from.k, to.k);
    const duration = this.still ? 0 : clamp(620 + Math.sqrt(pixels) * 40, 900, 2400);
    // On a long trip, pull back far enough to watch most of it go by.
    const reach = Math.min(this.width, this.height) * 0.85;
    const dip = pixels > reach ? clamp(reach / span, this.minZoom(), Math.min(from.k, to.k)) : 0;
    this.pristine = false;
    this.zoomGoal = null;
    this.glide.vx = this.glide.vy = 0;
    if (duration) {
      this.flight = { from, to, dip, start: this.clock, duration };
    } else {
      this.flight = null;
      this.cam = to;
    }
    this.sendJet(spot, x, duration);
    this.baseDirty = true;
  }

  // —— Jet ——

  private sendJet(spot: Spot, x: number, duration: number) {
    const jet = this.jet;
    const y = worldY(spot.lat);
    if (!jet.shown || !duration) {
      jet.shown = true;
      jet.x = x;
      jet.y = y;
      jet.route = null;
      jet.park = 1;
      this.trail.length = 0;
      return;
    }
    const start = this.nearestCopy(wrapLongitude(jet.x));
    const points = greatCircle(
      { lat: latitudeAt(jet.y), lng: wrapLongitude(jet.x) },
      spot,
      ROUTE_STEPS,
      start,
    );
    const shift = x - points[ROUTE_STEPS][0];
    for (const point of points) point[0] += shift;
    if (Math.hypot(points[0][0] - x, points[0][1] - y) < 0.02) return;
    if (shift) this.trail.length = 0;
    jet.route = { points, start: this.clock, duration, ease: easeInOut };
  }

  /** She flies in from off the edge of the paper to where she is now. */
  private arrive() {
    const target =
      this.dots.find((dot) => dot.place.kind === "current") ?? this.home ?? this.dots[0];
    if (!target || !this.width) return;
    const jet = this.jet;
    jet.shown = true;
    jet.x = target.x;
    jet.y = target.y;
    if (this.still) return;
    const { k } = this.cam;
    const from: Point = [
      this.cam.x - (this.width / 2 + 90) / k,
      this.cam.y - this.height * 0.2 / k,
    ];
    const to: Point = [this.nearestCopy(target.x), target.y];
    const bend: Point = [
      lerp(from[0], to[0], 0.62),
      Math.min(from[1], to[1]) - Math.min(this.height * 0.24, 150) / k,
    ];
    const points: Point[] = [];
    for (let step = 0; step <= ROUTE_STEPS; step += 1) {
      const t = step / ROUTE_STEPS;
      const u = 1 - t;
      points.push([
        u * u * from[0] + 2 * u * t * bend[0] + t * t * to[0],
        u * u * from[1] + 2 * u * t * bend[1] + t * t * to[1],
      ]);
    }
    jet.x = from[0];
    jet.y = from[1];
    jet.route = { points, start: this.clock + 650, duration: 2300, ease: easeOut };
  }

  private moveJet(dt: number) {
    const jet = this.jet;
    const route = jet.route;
    if (!route) {
      jet.thrust = Math.max(0, jet.thrust - dt / 380);
      jet.park = Math.min(1, jet.park + dt / 520);
      return false;
    }
    const raw = (this.clock - route.start) / route.duration;
    if (raw <= 0) return true;
    const t = route.ease(clamp(raw, 0, 1));
    const at = t * ROUTE_STEPS;
    const index = Math.min(ROUTE_STEPS - 1, Math.floor(at));
    const a = route.points[index];
    const b = route.points[index + 1];
    jet.x = lerp(a[0], b[0], at - index);
    jet.y = lerp(a[1], b[1], at - index);
    if (raw < 0.985) {
      const heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
      jet.facing = Math.cos(heading) >= 0 ? 1 : -1;
      jet.angle = heading;
    }
    jet.thrust = clamp(Math.sin(Math.PI * clamp(raw, 0, 1)) * 1.8, 0.25, 1);
    jet.park = Math.max(0, jet.park - dt / 200);
    this.trail.push({ x: jet.x, y: jet.y, at: this.clock });
    if (Math.random() < dt / 34) {
      this.sparks.push({
        x: jet.x,
        y: jet.y,
        vx: (Math.random() - 0.5) * 0.03,
        vy: (Math.random() - 0.5) * 0.03,
        at: this.clock,
        hue: Math.floor(Math.random() * 3),
      });
    }
    if (raw >= 1) {
      jet.x = route.points[ROUTE_STEPS][0];
      jet.y = route.points[ROUTE_STEPS][1];
      jet.route = null;
    }
    return true;
  }

  // —— Input ——

  private listen() {
    const host = this.host;
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      host.addEventListener(type, handler as EventListener, options);
      this.cleanups.push(() => host.removeEventListener(type, handler as EventListener, options));
    };
    const local = (event: { clientX: number; clientY: number }) => {
      const rect = host.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    on("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      host.setPointerCapture?.(event.pointerId);
      const point = local(event);
      this.pointers.set(event.pointerId, point);
      this.stopMoving();
      this.zoomGoal = null;
      if (this.pointers.size === 1) {
        this.press = { ...point, at: performance.now(), moved: false };
        this.lastMove = { ...point, at: performance.now() };
      } else if (this.press) {
        this.press.moved = true;
      }
      if (!this.pinMode) host.style.cursor = "grabbing";
    });

    on("pointermove", (event) => {
      const point = local(event);
      const held = this.pointers.get(event.pointerId);
      if (!held) {
        if (event.pointerType === "mouse") this.point(point.x, point.y);
        return;
      }
      if (this.pointers.size === 1) {
        const press = this.press;
        if (press && !press.moved && Math.hypot(point.x - press.x, point.y - press.y) > 6) {
          press.moved = true;
        }
        if (press?.moved) {
          const now = performance.now();
          const dx = point.x - held.x;
          const dy = point.y - held.y;
          this.pan(dx, dy);
          const dt = Math.max(1, now - this.lastMove.at);
          this.glide.vx = lerp(this.glide.vx, dx / dt, 0.6);
          this.glide.vy = lerp(this.glide.vy, dy / dt, 0.6);
          this.lastMove = { ...point, at: now };
        }
      } else if (this.pointers.size === 2) {
        const [first, second] = [...this.pointers.entries()];
        const other = first[0] === event.pointerId ? second[1] : first[1];
        const before = Math.hypot(held.x - other.x, held.y - other.y);
        const after = Math.hypot(point.x - other.x, point.y - other.y);
        const midX = (point.x + other.x) / 2;
        const midY = (point.y + other.y) / 2;
        this.pan((point.x - held.x) / 2, (point.y - held.y) / 2);
        if (before > 0) this.zoomAt(this.cam.k * (after / before), midX, midY);
        this.glide.vx = this.glide.vy = 0;
      }
      this.pointers.set(event.pointerId, point);
    });

    const release = (event: PointerEvent, tapped: boolean) => {
      if (!this.pointers.delete(event.pointerId)) return;
      const press = this.press;
      if (this.pointers.size === 0) {
        this.press = null;
        if (!this.pinMode) host.style.cursor = "grab";
        const now = performance.now();
        if (tapped && press && !press.moved && now - press.at < 700) {
          this.glide.vx = this.glide.vy = 0;
          this.tap(press.x, press.y, event.pointerType !== "mouse");
        } else if (now - this.lastMove.at > 90) {
          this.glide.vx = this.glide.vy = 0;
        }
      } else {
        this.glide.vx = this.glide.vy = 0;
      }
    };
    on("pointerup", (event) => release(event, true));
    on("pointercancel", (event) => release(event, false));
    on("pointerleave", (event) => {
      if (event.pointerType === "mouse" && !this.pointers.size) this.point(-1, -1);
    });

    on(
      "wheel",
      (event) => {
        event.preventDefault();
        const point = local(event);
        const lines = event.deltaMode === 1 ? 18 : 1;
        const pull = event.deltaY * lines * (event.ctrlKey ? 0.012 : 0.0018);
        const from = this.zoomGoal?.k ?? this.cam.k;
        this.flight = null;
        this.glide.vx = this.glide.vy = 0;
        this.zoomGoal = { k: this.limitZoom(from * Math.exp(-pull)), px: point.x, py: point.y };
        this.pristine = false;
      },
      { passive: false },
    );

    // Desktop Safari reports a trackpad pinch only through gesture events.
    // On a phone the same pinch already arrives as two pointers.
    type Pinch = Event & { scale: number; clientX: number; clientY: number };
    on("gesturestart" as keyof HTMLElementEventMap, (event) => {
      event.preventDefault();
      this.pinchStart = this.cam.k;
    });
    on("gesturechange" as keyof HTMLElementEventMap, (event) => {
      event.preventDefault();
      if (this.pointers.size) return;
      const pinch = event as unknown as Pinch;
      const point = local(pinch);
      this.flight = null;
      this.zoomAt(this.pinchStart * pinch.scale, point.x, point.y);
    });

    on("keydown", (event) => {
      const step = 90;
      if (event.key === "ArrowLeft") this.pan(step, 0);
      else if (event.key === "ArrowRight") this.pan(-step, 0);
      else if (event.key === "ArrowUp") this.pan(0, step);
      else if (event.key === "ArrowDown") this.pan(0, -step);
      else if (event.key === "+" || event.key === "=") this.zoomBy(1.6);
      else if (event.key === "-" || event.key === "_") this.zoomBy(1 / 1.6);
      else if (event.key === "0") this.resetView();
      else return;
      event.preventDefault();
    });

    const onMotion = () => {
      this.still = this.motion.matches;
      this.topDirty = true;
    };
    this.motion.addEventListener("change", onMotion);
    this.cleanups.push(() => this.motion.removeEventListener("change", onMotion));
  }

  private pan(dx: number, dy: number) {
    this.flight = null;
    this.cam.x -= dx / this.cam.k;
    this.cam.y -= dy / this.cam.k;
    this.settle(this.cam);
    this.pristine = false;
    this.baseDirty = true;
  }

  private zoomAt(k: number, px: number, py: number) {
    const cam = this.cam;
    const next = this.limitZoom(k);
    const worldX = cam.x + (px - this.width / 2) / cam.k;
    const worldYAt = cam.y + (py - this.height / 2) / cam.k;
    cam.k = next;
    cam.x = worldX - (px - this.width / 2) / next;
    cam.y = worldYAt - (py - this.height / 2) / next;
    this.settle(cam);
    this.pristine = false;
    this.baseDirty = true;
  }

  private hit(x: number, y: number, reach: number) {
    let best: Mark | null = null;
    let bestDistance = reach;
    for (const mark of this.marks) {
      const distance = Math.hypot(mark.x - x, mark.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = mark;
      }
    }
    return best;
  }

  private point(x: number, y: number) {
    if (this.pinMode) return;
    const id = this.hit(x, y, 16)?.dot.place.id ?? null;
    if (id === this.hover) return;
    this.hover = id;
    this.host.style.cursor = id ? "pointer" : "grab";
    this.topDirty = true;
  }

  private tap(x: number, y: number, finger: boolean) {
    const now = performance.now();
    const again =
      now - this.lastTap.at < 320 && Math.hypot(x - this.lastTap.x, y - this.lastTap.y) < 30;
    this.lastTap = { x, y, at: again ? 0 : now };
    if (this.pinMode) {
      const cam = this.cam;
      this.events.onPin({
        lat: latitudeAt(cam.y + (y - this.height / 2) / cam.k),
        lng: wrapLongitude(cam.x + (x - this.width / 2) / cam.k),
      });
      return;
    }
    const mark = this.hit(x, y, finger ? 26 : 16);
    if (again && !mark) {
      this.zoomGoal = { k: this.limitZoom(this.cam.k * 2), px: x, py: y };
      this.pristine = false;
      return;
    }
    this.events.onSelect(mark ? mark.dot.place.id : null);
  }

  // —— Frame ——

  private tick = (now: number) => {
    this.frame = requestAnimationFrame(this.tick);
    const dt = clamp(now - (this.last || now), 0, 48);
    this.last = now;
    this.clock += dt;
    if (!this.width) return;

    let moving = false;
    const cam = this.cam;

    if (this.flight) {
      const { from, to, dip, start, duration } = this.flight;
      const raw = clamp((this.clock - start) / duration, 0, 1);
      const t = easeInOut(raw);
      let zoom = lerp(Math.log(from.k), Math.log(to.k), t);
      if (dip) zoom = lerp(zoom, Math.log(dip), Math.pow(Math.sin(Math.PI * t), 1.3));
      cam.k = Math.exp(zoom);
      cam.x = lerp(from.x, to.x, t);
      cam.y = lerp(from.y, to.y, t);
      if (raw >= 1) this.flight = null;
      moving = true;
    } else if (this.zoomGoal) {
      const goal = this.zoomGoal;
      const pull = this.still ? 1 : 1 - Math.exp(-dt / 70);
      const next = Math.exp(lerp(Math.log(cam.k), Math.log(goal.k), pull));
      const done = Math.abs(next - goal.k) < goal.k * 0.002;
      this.zoomAt(done ? goal.k : next, goal.px, goal.py);
      if (done) this.zoomGoal = null;
      moving = true;
    } else if (!this.pointers.size && (this.glide.vx || this.glide.vy)) {
      const { vx, vy } = this.glide;
      cam.x -= (vx * dt) / cam.k;
      cam.y -= (vy * dt) / cam.k;
      this.settle(cam);
      const drag = Math.exp(-dt / 300);
      this.glide.vx = Math.abs(vx) < 0.01 ? 0 : vx * drag;
      this.glide.vy = Math.abs(vy) < 0.01 ? 0 : vy * drag;
      moving = true;
    }

    if (this.world && this.landAlpha < 1) {
      this.landAlpha = Math.min(1, this.landAlpha + dt / 700);
      moving = true;
    }
    if (this.moveJet(dt)) moving = true;
    if (moving) this.baseDirty = true;

    if (this.baseDirty) {
      this.drawBase();
      this.baseDirty = false;
      this.topDirty = true;
    }

    // Idle, the threads only sway: thirty frames a second is plenty.
    const breathing =
      !this.still && (moving || this.pointers.size > 0 || now - this.drawn > 30);
    if (this.topDirty || breathing) {
      this.drawTop(now - this.drawn);
      this.drawn = now;
      this.topDirty = false;
    }
  };

  private markVisited() {
    const world = this.world;
    if (!world) return;
    const found = new Set<Country>();
    for (const dot of this.dots) {
      const country = countryAt(world, dot.place.lat, dot.place.lng);
      if (country) found.add(country);
    }
    this.visited = [...found];
  }

  private makePatterns() {
    const ratio = this.ratio;
    const tile = (size: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = Math.round(size * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      paint(ctx);
      return this.baseCtx.createPattern(canvas, "repeat");
    };
    const random = seeded("pith");
    this.speckle = tile(SPECKLE_TILE, (ctx) => {
      ctx.fillStyle = this.tones.speck;
      for (let dot = 0; dot < 46; dot += 1) {
        const size = 0.7 + random() * 0.8;
        ctx.fillRect(random() * SPECKLE_TILE, random() * SPECKLE_TILE, size, size);
      }
    });
    this.haloDense = tile(4, (ctx) => {
      ctx.fillStyle = this.tones.halo;
      ctx.fillRect(0, 0, 1.4, 1.4);
      ctx.fillRect(2, 2, 1.4, 1.4);
    });
    this.haloSparse = tile(6, (ctx) => {
      ctx.fillStyle = this.tones.halo;
      ctx.fillRect(1, 1, 1.3, 1.3);
      ctx.fillRect(4, 4, 1.1, 1.1);
    });
  }

  private copies(left: number, right: number) {
    const { cam, width } = this;
    const half = width / (2 * cam.k);
    return {
      first: Math.ceil((cam.x - half - right) / WORLD_WIDTH),
      last: Math.floor((cam.x + half - left) / WORLD_WIDTH),
    };
  }

  private drawBase() {
    const { baseCtx: ctx, width, height, ratio, cam, tones, world } = this;
    const k = cam.k;
    const originX = width / 2 - cam.x * k;
    const originY = height / 2 - cam.y * k;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = tones.ground;
    ctx.fillRect(0, 0, width, height);

    const anchor = (pattern: CanvasPattern | null, size: number) => {
      pattern?.setTransform(
        new DOMMatrix().translate(mod(originX, size), mod(originY, size)).scale(1 / ratio),
      );
      return pattern;
    };
    const speckle = anchor(this.speckle, SPECKLE_TILE);
    if (speckle) {
      ctx.fillStyle = speckle;
      ctx.fillRect(0, 0, width, height);
    }

    this.drawGraticule(ctx, originX, originY);
    if (!world) return;

    ctx.globalAlpha = this.landAlpha;
    ctx.lineJoin = "round";
    const { first, last } = this.copies(-180, 200);
    for (let copy = first; copy <= last; copy += 1) {
      ctx.setTransform(
        ratio * k,
        0,
        0,
        ratio * k,
        ratio * (originX + copy * WORLD_WIDTH * k),
        ratio * originY,
      );
      ctx.fillStyle = tones.land;
      ctx.fill(world.land, "evenodd");
      if (k > 2.2) {
        ctx.lineWidth = 0.6 / k;
        ctx.strokeStyle = tones.border;
        ctx.stroke(world.borders);
      }
      ctx.lineWidth = 0.75 / k;
      ctx.strokeStyle = tones.coast;
      ctx.stroke(world.coast);
    }

    // Visited countries wear a stippled bloom that fades into the sea.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const bloom = clamp(4 + k * 1.1, 6, 19);
    const dense = anchor(this.haloDense, 4);
    const sparse = anchor(this.haloSparse, 6);
    const outlines: Path2D[] = [];
    for (const country of this.visited) {
      const range = this.copies(country.bounds[0] - 4, country.bounds[2] + 4);
      for (let copy = range.first; copy <= range.last; copy += 1) {
        const outline = new Path2D();
        outline.addPath(
          country.path,
          new DOMMatrix([k, 0, 0, k, originX + copy * WORLD_WIDTH * k, originY]),
        );
        outlines.push(outline);
      }
    }
    if (dense && sparse) {
      for (const outline of outlines) {
        ctx.strokeStyle = sparse;
        ctx.lineWidth = bloom * 2;
        ctx.stroke(outline);
        ctx.strokeStyle = dense;
        ctx.lineWidth = bloom;
        ctx.stroke(outline);
      }
    }
    for (const outline of outlines) {
      ctx.fillStyle = tones.visited;
      ctx.fill(outline, "evenodd");
      ctx.strokeStyle = tones.visitedEdge;
      ctx.lineWidth = 0.9;
      ctx.stroke(outline);
    }
    ctx.globalAlpha = 1;
  }

  private drawGraticule(ctx: CanvasRenderingContext2D, originX: number, originY: number) {
    const { width, height, cam, tones } = this;
    const k = cam.k;
    const step = [1, 2, 5, 10, 15, 30].find((size) => size * k >= 58) ?? 30;
    const top = Math.max(0, originY + WORLD_TOP * k);
    const bottom = Math.min(height, originY + WORLD_BOTTOM * k);
    if (bottom <= top) return;

    const columns: number[] = [];
    const startX = Math.ceil((cam.x - width / (2 * k)) / step) * step;
    for (let x = startX; originX + x * k <= width; x += step) columns.push(originX + x * k);
    const rows: number[] = [];
    for (let lat = -90 + step; lat < 90; lat += step) {
      if (lat > 84 || lat < -58) continue;
      const y = originY + worldY(lat) * k;
      if (y >= top && y <= bottom) rows.push(y);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = tones.grid;
    ctx.beginPath();
    for (const x of columns) {
      ctx.moveTo(Math.round(x) + 0.5, top);
      ctx.lineTo(Math.round(x) + 0.5, bottom);
    }
    for (const y of rows) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle = tones.gridMark;
    ctx.beginPath();
    for (const x of columns) {
      for (const y of rows) {
        const px = Math.round(x) + 0.5;
        const py = Math.round(y) + 0.5;
        ctx.moveTo(px - 3, py);
        ctx.lineTo(px + 3, py);
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px, py + 3);
      }
    }
    ctx.stroke();
  }

  private growth(dot: Dot) {
    if (this.still || !dot.thread) return 1;
    return clamp((this.clock - dot.born) / dot.thread.duration, 0, 1);
  }

  private presence(dot: Dot) {
    if (this.still) return 1;
    if (!dot.thread) return clamp((this.clock - dot.born + 200) / 420, 0, 1);
    return clamp((this.growth(dot) - 0.82) / 0.18, 0, 1);
  }

  private drawTop(elapsed: number) {
    const dt = clamp(elapsed, 0, 64);
    const { topCtx: ctx, width, height, ratio, cam } = this;
    const k = cam.k;
    const originX = width / 2 - cam.x * k;
    const originY = height / 2 - cam.y * k;
    const time = this.still ? 0 : this.clock;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.drawThreads(ctx, originX, originY, time);

    const marks: Mark[] = [];
    for (const dot of this.dots) {
      const { first, last } = this.copies(dot.x - 2, dot.x + 2);
      for (let copy = first; copy <= last; copy += 1) {
        const x = originX + (dot.x + copy * WORLD_WIDTH) * k;
        const y = originY + dot.y * k;
        if (y < -30 || y > height + 30) continue;
        marks.push({ dot, x, y });
      }
    }
    this.marks = marks;

    const rank = (mark: Mark) => {
      const { id, kind } = mark.dot.place;
      if (id === this.selected) return 4;
      if (id === this.hover) return 3;
      return kind === "current" ? 2 : kind === "hometown" ? 1 : 0;
    };
    const ordered = [...marks].sort((a, b) => rank(a) - rank(b));
    const size = clamp(0.9 + Math.log2(k / 3) * 0.1, 0.82, 1.35);
    for (const mark of ordered) this.drawToken(ctx, mark, size, time);
    this.drawLabels(ctx, ordered.reverse(), size, dt);
    this.drawPin(ctx, originX, originY, time);
    this.drawJetLayer(ctx, originX, originY, size);
  }

  private drawThreads(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    time: number,
  ) {
    const { tones, scratchX: xs, scratchY: ys } = this;
    const k = this.cam.k;
    const chosen = this.selected ?? this.hover;
    const beads: number[] = [];
    const litBeads: number[] = [];

    // One stroke per shade of silver rather than one per strand: the same
    // picture for a fraction of the drawing.
    for (let tone = 0; tone <= 5; tone += 1) {
      const lit = tone === 5;
      let sheen: CanvasGradient | null = null;
      ctx.beginPath();
      for (const dot of this.dots) {
        const thread = dot.thread;
        if (!thread) continue;
        const isLit = dot.place.id === this.selected || dot.place.id === this.hover;
        if (isLit !== lit) continue;
        const grown = this.growth(dot);
        if (grown <= 0) continue;
        const reach = grown * STEPS;
        const whole = Math.min(STEPS, Math.floor(reach));
        const part = reach - whole;
        const count = Math.min(STEPS, whole + 1);
        const sway = Math.min(thread.length * 0.03, 22 / k);
        const { first, last } = this.copies(thread.left, thread.right);
        for (let copy = first; copy <= last; copy += 1) {
          const shift = originX + copy * WORLD_WIDTH * k;
          for (const strand of thread.strands) {
            if (!lit && strand.tone !== tone) continue;
            for (let index = 0; index <= count; index += 1) {
              const t = index / STEPS;
              const wave =
                0.62 * Math.sin(TAU * strand.f1 * t + strand.p1 + time * strand.w1) +
                0.38 * Math.sin(TAU * strand.f2 * t + strand.p2 - time * strand.w2);
              const offset = sway * ENVELOPE[index] * (strand.spread * 0.62 + wave * 0.38);
              xs[index] =
                shift + (thread.points[index * 2] + thread.normals[index * 2] * offset) * k;
              ys[index] =
                originY +
                (thread.points[index * 2 + 1] + thread.normals[index * 2 + 1] * offset) * k;
            }
            ctx.moveTo(xs[0], ys[0]);
            for (let index = 1; index <= whole; index += 1) ctx.lineTo(xs[index], ys[index]);
            if (whole < STEPS && part > 0) {
              ctx.lineTo(
                lerp(xs[whole], xs[whole + 1], part),
                lerp(ys[whole], ys[whole + 1], part),
              );
            }
            if (lit && !sheen) {
              sheen = ctx.createLinearGradient(xs[0], ys[0], xs[count], ys[count]);
              const turn = mod(time * 0.00006, 1);
              for (let stop = 0; stop < IRIDESCENT.length; stop += 1) {
                sheen.addColorStop(mod(stop / (IRIDESCENT.length - 1) + turn, 1), IRIDESCENT[stop]);
              }
            }
            if (grown < 1) continue;
            // Seed pearls strung on the thread, drifting out from home.
            for (const bead of strand.beads) {
              const along = mod(bead + time * strand.pace, 1) * STEPS;
              const index = Math.min(STEPS - 1, Math.floor(along));
              (lit ? litBeads : beads).push(
                lerp(xs[index], xs[index + 1], along - index),
                lerp(ys[index], ys[index + 1], along - index),
                Math.sqrt(Math.sin((Math.PI * along) / STEPS)),
              );
            }
          }
        }
      }
      if (lit) {
        if (!sheen) continue;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = sheen;
        ctx.lineWidth = 1.5;
      } else {
        ctx.globalAlpha = chosen ? 0.4 : 0.86;
        ctx.strokeStyle = tones.threads[tone];
        ctx.lineWidth = tone === 2 ? 0.95 : 0.7;
      }
      ctx.stroke();
    }

    const string = (list: number[], radius: number, alpha: number, edge: string) => {
      if (!list.length) return;
      ctx.beginPath();
      for (let index = 0; index < list.length; index += 3) {
        const r = radius * list[index + 2];
        if (r < 0.3) continue;
        ctx.moveTo(list[index] + r, list[index + 1]);
        ctx.arc(list[index], list[index + 1], r, 0, TAU);
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = tones.bead;
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = edge;
      ctx.stroke();
    };
    string(beads, 1.5, chosen ? 0.45 : 1, tones.beadEdge);
    string(litBeads, 2.1, 1, IRIDESCENT[2]);
    ctx.globalAlpha = 1;
  }

  private iridescence(ctx: CanvasRenderingContext2D, x: number, y: number, turn: number) {
    if (typeof ctx.createConicGradient !== "function") {
      const fallback = ctx.createLinearGradient(x - 12, y - 12, x + 12, y + 12);
      IRIDESCENT.forEach((colour, index) =>
        fallback.addColorStop(index / (IRIDESCENT.length - 1), colour),
      );
      return fallback;
    }
    const sheen = ctx.createConicGradient(turn, x, y);
    IRIDESCENT.forEach((colour, index) =>
      sheen.addColorStop(index / (IRIDESCENT.length - 1), colour),
    );
    return sheen;
  }

  private drawToken(ctx: CanvasRenderingContext2D, mark: Mark, size: number, time: number) {
    const { tones } = this;
    const { dot, x, y } = mark;
    const shown = this.presence(dot);
    if (shown <= 0) return;
    const { kind, id } = dot.place;
    const chosen = id === this.selected;
    const lit = chosen || id === this.hover;
    const pop = size * (0.6 + 0.4 * easeOut(shown));
    const pulse = 1 + 0.1 * Math.sin(time * 0.0019 + dot.phase);

    ctx.globalAlpha = shown;

    if (lit) {
      const ring = (kind === "visited" ? 9.5 : 11.5) * pop;
      ctx.beginPath();
      ctx.arc(x, y, ring, 0, TAU);
      ctx.lineWidth = 4.6;
      ctx.strokeStyle = tones.dark ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.9)";
      ctx.stroke();
      ctx.lineWidth = chosen ? 2.6 : 2;
      ctx.strokeStyle = this.iridescence(ctx, x, y, time * 0.0011 + dot.phase);
      ctx.stroke();
    }

    if (kind === "hometown") {
      const r = 6.4 * pop;
      const shadow = ctx.createRadialGradient(x, y + r * 0.35, r * 0.5, x, y + r * 0.35, r * 1.9);
      shadow.addColorStop(0, tones.pearlShadow);
      shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.35, r * 1.9, 0, TAU);
      ctx.fill();

      const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      body.addColorStop(0, "#ffffff");
      body.addColorStop(0.55, "#f6f2ee");
      body.addColorStop(1, "#c9cfd6");
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = shown * 0.5;
      ctx.fillStyle = this.iridescence(ctx, x + r * 0.2, y + r * 0.25, time * 0.0005);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = shown * 0.95;
      const gleam = ctx.createRadialGradient(
        x - r * 0.36,
        y - r * 0.42,
        0,
        x - r * 0.36,
        y - r * 0.42,
        r * 0.6,
      );
      gleam.addColorStop(0, "rgba(255, 255, 255, 1)");
      gleam.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gleam;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
      ctx.globalAlpha = shown;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = tones.pearlEdge;
      ctx.stroke();
    } else if (kind === "current") {
      const r = 4.7 * pop;
      if (time) {
        const beat = mod(time / 2800, 1);
        ctx.globalAlpha = shown * (1 - beat) * 0.55;
        ctx.beginPath();
        ctx.arc(x, y, r + 2 + beat * 15 * size, 0, TAU);
        ctx.lineWidth = 1;
        ctx.strokeStyle = tones.cobalt;
        ctx.stroke();
        ctx.globalAlpha = shown;
      }
      const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.9);
      halo.addColorStop(0, `rgba(${tones.cobaltGlow}, 0.34)`);
      halo.addColorStop(1, `rgba(${tones.cobaltGlow}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.9, 0, TAU);
      ctx.fill();
      const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
      body.addColorStop(0, tones.cobaltLight);
      body.addColorStop(0.6, tones.cobalt);
      body.addColorStop(1, tones.cobaltDeep);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.22, 0, TAU);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fill();
    } else {
      const r = 3.5 * pop;
      const glow = r * 3.7 * pulse;
      const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, glow);
      halo.addColorStop(0, `rgba(${tones.aquaGlow}, 0.62)`);
      halo.addColorStop(0.45, `rgba(${tones.aquaGlow}, 0.2)`);
      halo.addColorStop(1, `rgba(${tones.aquaGlow}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, glow, 0, TAU);
      ctx.fill();
      const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
      body.addColorStop(0, "#ffffff");
      body.addColorStop(1, tones.aquaCore);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = tones.aquaEdge;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawLabels(ctx: CanvasRenderingContext2D, marks: Mark[], size: number, dt: number) {
    const { tones, width, height } = this;
    const k = this.cam.k;
    const narrow = width < 720;
    const fontSize = narrow ? 14 : 15;
    ctx.font = `italic 400 ${fontSize}px ${this.font}`;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    type Box = [number, number, number, number];
    const taken: Box[] = marks.map((mark) => [mark.x - 6, mark.y - 6, mark.x + 6, mark.y + 6]);
    const free = (box: Box, own: number) =>
      taken.every(
        (other, index) =>
          index === own ||
          box[2] < other[0] ||
          box[0] > other[2] ||
          box[3] < other[1] ||
          box[1] > other[3],
      );
    const wanted = new Map<Dot, { x: number; y: number; align: CanvasTextAlign }>();

    marks.forEach((mark, own) => {
      const { dot } = mark;
      const { id, kind } = dot.place;
      const lit = id === this.selected || id === this.hover;
      if (this.presence(dot) < 1 || wanted.has(dot)) return;
      if (!lit && kind === "visited" && k < 2.3) return;
      const textWidth = ctx.measureText(dot.title).width;
      const gap = (kind === "visited" ? 9 : 12) * size + (lit ? 4 : 0);
      const tall = fontSize + 2;
      const tries: Array<{ x: number; y: number; align: CanvasTextAlign; box: Box }> = [
        { x: mark.x + gap, y: mark.y, align: "left", box: [mark.x + gap, mark.y - tall / 2, mark.x + gap + textWidth, mark.y + tall / 2] },
        { x: mark.x - gap, y: mark.y, align: "right", box: [mark.x - gap - textWidth, mark.y - tall / 2, mark.x - gap, mark.y + tall / 2] },
        { x: mark.x, y: mark.y - gap - tall / 2, align: "center", box: [mark.x - textWidth / 2, mark.y - gap - tall, mark.x + textWidth / 2, mark.y - gap] },
        { x: mark.x, y: mark.y + gap + tall / 2, align: "center", box: [mark.x - textWidth / 2, mark.y + gap, mark.x + textWidth / 2, mark.y + gap + tall] },
      ];
      const fit =
        tries.find(
          ({ box }) =>
            box[0] > 4 && box[2] < width - 4 && box[1] > 4 && box[3] < height - 4 && free(box, own),
        ) ?? (lit ? tries[0] : null);
      if (!fit) return;
      taken.push(fit.box);
      wanted.set(dot, fit);
    });

    const rate = this.still ? 1 : dt / 160;
    for (const dot of this.dots) {
      const spot = wanted.get(dot);
      dot.label = clamp(dot.label + (spot ? rate : -rate), 0, 1);
      if (!spot || dot.label <= 0) continue;
      ctx.globalAlpha = dot.label;
      ctx.textAlign = spot.align;
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = tones.ground;
      ctx.strokeText(dot.title, spot.x, spot.y);
      ctx.fillStyle = tones.ink;
      ctx.fillText(dot.title, spot.x, spot.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawPin(ctx: CanvasRenderingContext2D, originX: number, originY: number, time: number) {
    const pin = this.pin;
    if (!pin) return;
    const k = this.cam.k;
    const { first, last } = this.copies(pin.x - 2, pin.x + 2);
    for (let copy = first; copy <= last; copy += 1) {
      const x = originX + (pin.x + copy * WORLD_WIDTH) * k;
      const y = originY + pin.y * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 0.0006);
      ctx.setLineDash([3.2, 3.6]);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = this.iridescence(ctx, 0, 0, 0);
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = this.tones.aquaEdge;
      ctx.stroke();
    }
  }

  private drawJetLayer(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    size: number,
  ) {
    const jet = this.jet;
    if (!jet.shown) return;
    const k = this.cam.k;
    const now = this.clock;
    const life = 950;
    while (this.trail.length && now - this.trail[0].at > life) this.trail.shift();
    while (this.sparks.length && now - this.sparks[0].at > 800) this.sparks.shift();
    if (jet.route && now < jet.route.start) return;

    const scale = (this.width < 720 ? 0.62 : 0.74) * clamp(size, 0.9, 1.15);
    const { first, last } = this.copies(jet.x - 40, jet.x + 40);
    for (let copy = first; copy <= last; copy += 1) {
      const shift = originX + copy * WORLD_WIDTH * k;

      for (let index = 1; index < this.trail.length; index += 1) {
        const a = this.trail[index - 1];
        const b = this.trail[index];
        const age = 1 - (now - b.at) / life;
        ctx.beginPath();
        ctx.moveTo(shift + a.x * k, originY + a.y * k);
        ctx.lineTo(shift + b.x * k, originY + b.y * k);
        ctx.lineWidth = 1 + 5 * age * scale;
        ctx.strokeStyle = `rgba(255, 158, 204, ${0.5 * age * age})`;
        ctx.stroke();
        ctx.lineWidth = 0.6 + 1.6 * age * scale;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * age})`;
        ctx.stroke();
      }
      for (const spark of this.sparks) {
        const age = (now - spark.at) / 800;
        const x = shift + (spark.x + (spark.vx * (now - spark.at)) / k) * k;
        const y = originY + (spark.y + (spark.vy * (now - spark.at)) / k) * k;
        const r = 2.6 * (1 - age) * scale + 0.4;
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = ["#ff9ecb", "#ffffff", "#bfeaf5"][spark.hue];
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.8);
        ctx.quadraticCurveTo(x, y, x + r * 1.8, y);
        ctx.quadraticCurveTo(x, y, x, y + r * 1.8);
        ctx.quadraticCurveTo(x, y, x - r * 1.8, y);
        ctx.quadraticCurveTo(x, y, x, y - r * 1.8);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const park = easeInOut(jet.park);
      const bob = this.still ? 0 : Math.sin(now * 0.0031) * 2.4 * park;
      const rest = jet.facing === 1 ? -0.14 : Math.PI + 0.14;
      let turn = rest - jet.angle;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      drawJet(
        ctx,
        {
          x: shift + jet.x * k + jet.facing * 15 * park * size,
          y: originY + jet.y * k - 21 * park * size + bob,
          angle: jet.angle + turn * park,
          facing: jet.facing,
          scale,
          thrust: jet.thrust,
          time: this.still ? 0 : now,
          alpha: 1,
        },
        this.mini,
      );
    }
  }
}
