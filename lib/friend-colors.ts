import type { FriendColor } from "@/lib/friend-types";

/* Curated crayon-swatch trios. Each row is three complementary shades with
   Orseund-style color names — assigned per friend from vibe keywords. */
const PALETTES: FriendColor[][] = [
  [
    { name: "Midnight Ink", hex: "#1f2a44" },
    { name: "Warm Clay", hex: "#c4a484" },
    { name: "Bone White", hex: "#efe6d8" },
  ],
  [
    { name: "Olive Grove", hex: "#5c6b4a" },
    { name: "Sunlit Straw", hex: "#d8c48a" },
    { name: "River Stone", hex: "#8a8f96" },
  ],
  [
    { name: "Cherry Stem", hex: "#8b3a3a" },
    { name: "Blush Paper", hex: "#e8c4b8" },
    { name: "Graphite", hex: "#4a4a4a" },
  ],
  [
    { name: "Sea Glass", hex: "#6f8f8a" },
    { name: "Sand Dollar", hex: "#d9cbb8" },
    { name: "Deep Harbor", hex: "#2c3e50" },
  ],
  [
    { name: "Saffron", hex: "#c9893a" },
    { name: "Indigo Night", hex: "#3d3a6b" },
    { name: "Cream Tea", hex: "#f0e6d2" },
  ],
  [
    { name: "Moss", hex: "#4f6b4a" },
    { name: "Brick Dust", hex: "#a65d4a" },
    { name: "Parchment", hex: "#ebe1cf" },
  ],
  [
    { name: "Cobalt Soft", hex: "#4a6fa5" },
    { name: "Antique Tan", hex: "#c2a27a" },
    { name: "Chalk", hex: "#f4f0e8" },
  ],
  [
    { name: "Plum Skin", hex: "#6b4a5e" },
    { name: "Honey Wax", hex: "#d4a85a" },
    { name: "Fog", hex: "#c8cdd2" },
  ],
  [
    { name: "Cedar", hex: "#6b4f3a" },
    { name: "Pine Needle", hex: "#3f5a45" },
    { name: "Morning Fog", hex: "#d5d8d4" },
  ],
  [
    { name: "Rosehip", hex: "#b45a62" },
    { name: "Sage Wash", hex: "#9aa88a" },
    { name: "Ivory", hex: "#f3ebe0" },
  ],
  [
    { name: "Espresso", hex: "#3b2a22" },
    { name: "Caramel", hex: "#b8885a" },
    { name: "Milk Foam", hex: "#f2e8dc" },
  ],
  [
    { name: "Lagoon", hex: "#3d6f7a" },
    { name: "Coral Soft", hex: "#d9897a" },
    { name: "Shell", hex: "#efe6de" },
  ],
];

const KEYWORD_PALETTE: Array<{ test: RegExp; index: number }> = [
  { test: /hustle|swagger|ambition|lightning|grit|thunder/i, index: 4 },
  { test: /romance|charm|peach|blush|lullab|starlight|velvet/i, index: 9 },
  { test: /clover|moss|pine|garden|tide|cedar|olive/i, index: 8 },
  { test: /brains|quiet|snow|bergamot|graphite|deep water/i, index: 0 },
  { test: /butter|honey|cocoa|bread|caramel|brown sugar/i, index: 10 },
  { test: /sea|harbor|night swimming|lake|rain|open window/i, index: 3 },
  { test: /fire|courage|resilience|radiance|cherry/i, index: 2 },
  { test: /goof|play|mischief|whimsy|exuberance|long summer/i, index: 5 },
  { test: /loyalty|good bones|steadiness|backbone|held doors/i, index: 1 },
  { test: /gravitas|candle|stardust|fearlessness|lightness/i, index: 7 },
];

function hashSlug(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

export function colorsForFriend(slug: string, madeOf: string[] = []): FriendColor[] {
  const vibe = madeOf.join(" ");
  const hit = KEYWORD_PALETTE.find((entry) => entry.test.test(vibe));
  const index = hit ? hit.index : hashSlug(slug) % PALETTES.length;
  return PALETTES[index].map((c) => ({ ...c }));
}
