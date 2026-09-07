export type StoreProduct = {
  id: string;
  slug: string;
  title: string;
  tease: string;
  category: string;
  priceInCents: number;
  edition: string;
  testOnly: true;
};

const STORE_PRICE_IN_CENTS = 22_200;

export const STORE_PRODUCTS = [
  {
    id: "secret-001",
    slug: "something-i-have-never-said-out-loud",
    title: "Something I Have Never Said Out Loud",
    tease: "A previously undisclosed sentence. No preview available.",
    category: "Confession",
    priceInCents: STORE_PRICE_IN_CENTS,
    edition: "1 of 1",
    testOnly: true,
  },
  {
    id: "secret-002",
    slug: "the-person-i-still-think-about",
    title: "The Person I Still Think About",
    tease: "Identity and circumstances withheld until purchase.",
    category: "Attachment",
    priceInCents: STORE_PRICE_IN_CENTS,
    edition: "1 of 1",
    testOnly: true,
  },
  {
    id: "secret-003",
    slug: "my-most-embarrassing-lie",
    title: "My Most Embarrassing Lie",
    tease: "One lie, its setting, and why I told it.",
    category: "Evidence",
    priceInCents: STORE_PRICE_IN_CENTS,
    edition: "1 of 1",
    testOnly: true,
  },
  {
    id: "secret-004",
    slug: "what-i-actually-want",
    title: "What I Actually Want",
    tease: "The answer I edit out when people ask.",
    category: "Desire",
    priceInCents: STORE_PRICE_IN_CENTS,
    edition: "1 of 1",
    testOnly: true,
  },
  {
    id: "secret-005",
    slug: "the-memory-i-keep-replaying",
    title: "The Memory I Keep Replaying",
    tease: "A small scene with unusually persistent consequences.",
    category: "Memory",
    priceInCents: STORE_PRICE_IN_CENTS,
    edition: "1 of 1",
    testOnly: true,
  },
  {
    id: "secret-006",
    slug: "the-version-of-me-no-one-met",
    title: "The Version of Me No One Met",
    tease: "A life considered and not selected.",
    category: "Alternate Self",
    priceInCents: STORE_PRICE_IN_CENTS,
    edition: "1 of 1",
    testOnly: true,
  },
] as const satisfies readonly StoreProduct[];

export type StoreProductId = (typeof STORE_PRODUCTS)[number]["id"];

export function getStoreProductById(id: string) {
  return STORE_PRODUCTS.find((product) => product.id === id);
}

export function getStoreProductBySlug(slug: string) {
  return STORE_PRODUCTS.find((product) => product.slug === slug);
}

export function formatStorePrice(priceInCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceInCents / 100);
}
