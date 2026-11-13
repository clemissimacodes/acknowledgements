// Geometry for the Places map: the projection, the country shapes and the
// great-circle paths the threads follow.
//
// World space is flat: x is longitude in degrees (it repeats every 360), y is
// the Miller cylindrical latitude in the same units, growing downward like the
// screen. Country shapes come from /places/world.json, Natural Earth 1:50m
// (public domain) by way of the world-atlas package (ISC), simplified.

const RAD = Math.PI / 180;

export const WORLD_WIDTH = 360;
export const LAT_LIMIT = 84;

export type Point = [number, number];

export function worldY(lat: number) {
  const clamped = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, lat));
  return (-1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * clamped * RAD))) / RAD;
}

export function latitudeAt(y: number) {
  return (2.5 * Math.atan(Math.exp(-0.8 * y * RAD)) - 0.625 * Math.PI) / RAD;
}

export function wrapLongitude(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export const WORLD_TOP = worldY(LAT_LIMIT);
export const WORLD_BOTTOM = worldY(-58);

type RawWorld = {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  countries: Array<{
    type: "Polygon" | "MultiPolygon";
    name: string;
    arcs: number[][] | number[][][];
  }>;
};

export type Country = {
  name: string;
  rings: Float32Array[];
  bounds: [number, number, number, number];
  path: Path2D;
};

export type World = {
  countries: Country[];
  land: Path2D;
  coast: Path2D;
  borders: Path2D;
};

export function buildWorld(raw: RawWorld): World {
  const [scaleX, scaleY] = raw.transform.scale;
  const [offsetX, offsetY] = raw.transform.translate;
  // Shapes that cross the antimeridian (Russia, Fiji) jump from +180 to -180
  // in the data. Carrying x past 180 instead keeps each outline in one piece;
  // the neighbouring copy of the world draws the part that runs over.
  const arcs = raw.arcs.map((arc) => {
    const points = new Float32Array(arc.length * 2);
    let x = 0;
    let y = 0;
    let turn = 0;
    let before = 0;
    arc.forEach(([dx, dy], index) => {
      x += dx;
      y += dy;
      const lng = x * scaleX + offsetX;
      if (index && Math.abs(lng - before) > 180) turn += lng < before ? 360 : -360;
      before = lng;
      points[index * 2] = lng + turn;
      points[index * 2 + 1] = worldY(y * scaleY + offsetY);
    });
    return points;
  });

  const uses = new Uint8Array(arcs.length);
  const ringOf = (indexes: number[]) => {
    let length = 0;
    for (const index of indexes) length += arcs[index < 0 ? ~index : index].length - 2;
    const ring = new Float32Array(length + 2);
    let at = 0;
    let shift = 0;
    indexes.forEach((index) => {
      const arc = arcs[index < 0 ? ~index : index];
      uses[index < 0 ? ~index : index] += 1;
      const count = arc.length / 2;
      const first = (index < 0 ? count - 1 : 0) * 2;
      if (at) shift = 360 * Math.round((ring[at - 2] - arc[first]) / 360);
      // Consecutive arcs share an endpoint; keep it once.
      for (let step = 0; step < count - 1; step += 1) {
        const from = (index < 0 ? count - 1 - step : step) * 2;
        ring[at++] = arc[from] + shift;
        ring[at++] = arc[from + 1];
      }
    });
    ring[at++] = ring[0];
    ring[at] = ring[1];
    return ring;
  };

  const land = new Path2D();
  const countries = raw.countries.map((country) => {
    const polygons =
      country.type === "Polygon"
        ? [country.arcs as number[][]]
        : (country.arcs as number[][][]);
    const rings = polygons.flatMap((polygon) => polygon.map(ringOf));
    const bounds: Country["bounds"] = [Infinity, Infinity, -Infinity, -Infinity];
    const path = new Path2D();
    for (const ring of rings) {
      path.moveTo(ring[0], ring[1]);
      for (let index = 2; index < ring.length; index += 2) {
        const x = ring[index];
        const y = ring[index + 1];
        path.lineTo(x, y);
        if (x < bounds[0]) bounds[0] = x;
        if (y < bounds[1]) bounds[1] = y;
        if (x > bounds[2]) bounds[2] = x;
        if (y > bounds[3]) bounds[3] = y;
      }
      path.closePath();
    }
    land.addPath(path);
    return { name: country.name, rings, bounds, path };
  });

  // An arc used by two countries is a border, by one a coast.
  const coast = new Path2D();
  const borders = new Path2D();
  arcs.forEach((arc, index) => {
    if (!uses[index]) return;
    const target = uses[index] > 1 ? borders : coast;
    target.moveTo(arc[0], arc[1]);
    for (let at = 2; at < arc.length; at += 2) target.lineTo(arc[at], arc[at + 1]);
  });

  return { countries, land, coast, borders };
}

function ringContains(ring: Float32Array, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ringDistance(ring: Float32Array, x: number, y: number) {
  let best = Infinity;
  for (let i = 0; i < ring.length - 2; i += 2) {
    const ax = ring[i];
    const ay = ring[i + 1];
    const dx = ring[i + 2] - ax;
    const dy = ring[i + 3] - ay;
    const span = dx * dx + dy * dy;
    const t = span ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / span)) : 0;
    const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (distance < best) best = distance;
  }
  return best;
}

/**
 * The country a spot belongs to. Coastlines are simplified, so a harbour city
 * can sit just off its own shore; the nearest coast within reach still counts.
 */
export function countryAt(world: World, lat: number, lng: number): Country | null {
  const y = worldY(lat);
  const reach = 1.2;
  let nearest: Country | null = null;
  let nearestDistance = reach;
  for (const country of world.countries) {
    const [left, top, right, bottom] = country.bounds;
    // A shape that runs past +180 holds its far-eastern points there.
    const x = wrapLongitude(lng) + (right > 180 && wrapLongitude(lng) < left - reach ? 360 : 0);
    if (x < left - reach || x > right + reach || y < top - reach || y > bottom + reach) continue;
    let inside = false;
    for (const ring of country.rings) {
      if (ringContains(ring, x, y)) inside = !inside;
    }
    if (inside) return country;
    for (const ring of country.rings) {
      const distance = ringDistance(ring, x, y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = country;
      }
    }
  }
  return nearest;
}

type Spot = { lat: number; lng: number };

function unit({ lat, lng }: Spot) {
  const phi = lat * RAD;
  const lambda = lng * RAD;
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

function angleBetween(a: Spot, b: Spot) {
  const [ax, ay, az] = unit(a);
  const [bx, by, bz] = unit(b);
  return Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
}

export function milesBetween(a: Spot, b: Spot) {
  return angleBetween(a, b) * 3958.8;
}

/**
 * The great circle from a to b in world space, as `steps + 1` points. x starts
 * at `startX` (any copy of a's longitude) and runs on without jumping at the
 * antimeridian, so the path can be drawn in one stroke.
 */
export function greatCircle(a: Spot, b: Spot, steps: number, startX = a.lng): Point[] {
  const from = unit(a);
  const to = unit(b);
  const omega = angleBetween(a, b);
  const points: Point[] = [];
  let previous = startX;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    let lat: number;
    let lng: number;
    if (omega < 1e-6) {
      lat = a.lat;
      lng = a.lng;
    } else {
      const fa = Math.sin((1 - t) * omega) / Math.sin(omega);
      const fb = Math.sin(t * omega) / Math.sin(omega);
      const x = fa * from[0] + fb * to[0];
      const y = fa * from[1] + fb * to[1];
      const z = fa * from[2] + fb * to[2];
      lat = Math.atan2(z, Math.hypot(x, y)) / RAD;
      lng = Math.atan2(y, x) / RAD;
    }
    const x = previous + wrapLongitude(lng - previous);
    previous = x;
    points.push([x, worldY(lat)]);
  }
  return points;
}
