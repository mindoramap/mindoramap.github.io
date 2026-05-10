export type ThemeMode = "light" | "dark";

export const THEME_KEY = "mm_theme";
export const THEME_EVENT = "mindora-theme-change";

const isThemeMode = (value: string | null): value is ThemeMode => value === "light" || value === "dark";

export const getSystemTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const getStoredTheme = (): ThemeMode | null => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(THEME_KEY);
  return isThemeMode(value) ? value : null;
};

export const getPreferredTheme = (): ThemeMode => getStoredTheme() || getSystemTheme();

export const applyTheme = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
};

export const setThemePreference = (theme: ThemeMode) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, theme);
  }

  applyTheme(theme);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_EVENT, { detail: theme }));
  }
};

export const initializeTheme = () => {
  applyTheme(getPreferredTheme());
};
