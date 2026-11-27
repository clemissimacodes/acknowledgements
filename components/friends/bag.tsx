"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BagItem = {
  slug: string;
  nickname: string;
  productName: string;
  price: string;
  heroUrl: string | null;
  colorName?: string;
  colorHex?: string;
};

type BagContextValue = {
  items: BagItem[];
  open: boolean;
  add: (item: BagItem) => void;
  remove: (slug: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  has: (slug: string) => boolean;
};

const BagContext = createContext<BagContextValue | null>(null);
const KEY = "ff-bag";

export function BagProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BagItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as BagItem[]);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  const add = useCallback((item: BagItem) => {
    setItems((current) =>
      current.some((entry) => entry.slug === item.slug) ? current : [...current, item],
    );
    setOpen(true);
  }, []);
  const remove = useCallback((slug: string) => {
    setItems((current) => current.filter((entry) => entry.slug !== slug));
  }, []);
  const clear = useCallback(() => setItems([]), []);
  const has = useCallback((slug: string) => items.some((entry) => entry.slug === slug), [items]);

  const value = useMemo(
    () => ({ items, open, add, remove, clear, setOpen, has }),
    [items, open, add, remove, clear, has],
  );
  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  const value = useContext(BagContext);
  if (!value) throw new Error("useBag must be used inside BagProvider");
  return value;
}

export function sumPrices(items: { price: string }[]) {
  return items.reduce((total, item) => total + Number(item.price || 0), 0);
}
