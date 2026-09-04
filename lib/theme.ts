export const THEMES = ["light", "dark", "aquamarine"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "ack-theme";

export const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  aquamarine: "Aqua",
};

export function isTheme(value: string | null | undefined): value is Theme {
  return THEMES.some((theme) => theme === value);
}
