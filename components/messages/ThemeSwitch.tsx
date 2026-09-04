"use client";

import { useCallback, useEffect, useState } from "react";
import {
  THEME_LABELS,
  THEME_STORAGE_KEY,
  THEMES,
  isTheme,
  type Theme,
} from "@/lib/theme";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const current = document.documentElement.getAttribute("data-theme");
  return isTheme(current) ? current : "light";
}

function writeTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore private-mode writes */
  }
  window.dispatchEvent(new Event("ack-theme"));
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    function sync() {
      setTheme(readTheme());
    }

    sync();
    window.addEventListener("ack-theme", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ack-theme", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const select = useCallback((next: Theme) => {
    writeTheme(next);
    setTheme(next);
  }, []);

  return (
    <div className="appearance" role="radiogroup" aria-label="Appearance">
      {THEMES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          className={theme === value ? "is-active" : undefined}
          onClick={() => select(value)}
        >
          {THEME_LABELS[value]}
        </button>
      ))}
    </div>
  );
}
