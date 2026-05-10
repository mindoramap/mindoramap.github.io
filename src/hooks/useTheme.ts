import { useEffect, useMemo, useState } from "react";
import {
  THEME_EVENT,
  applyTheme,
  getPreferredTheme,
  getStoredTheme,
  getSystemTheme,
  setThemePreference,
  type ThemeMode,
} from "@/lib/theme";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncTheme = () => setTheme(getPreferredTheme());
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (!getStoredTheme()) {
        setTheme(getSystemTheme());
      }
    };

    syncTheme();
    window.addEventListener(THEME_EVENT, syncTheme as EventListener);
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme as EventListener);
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const controls = useMemo(
    () => ({
      theme,
      setTheme: (next: ThemeMode) => setThemePreference(next),
      toggle: () => setThemePreference(theme === "light" ? "dark" : "light"),
    }),
    [theme]
  );

  return controls;
}
