import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];

const themeStorageKey = "pnp-settlement.theme";
const darkModeQuery = "(prefers-color-scheme: dark)";

function isTheme(value: string | null | undefined): value is Theme {
  return themes.includes(value as Theme);
}

function getThemeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function getStoredTheme(): Theme | undefined {
  const storedTheme = getThemeStorage()?.getItem(themeStorageKey);
  return isTheme(storedTheme) ? storedTheme : undefined;
}

function getSystemTheme(): Theme {
  return window.matchMedia(darkModeQuery).matches ? "dark" : "light";
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [followsSystem, setFollowsSystem] = useState(() => !getStoredTheme());
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    if (!followsSystem) return;
    const mediaQuery = window.matchMedia(darkModeQuery);
    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) =>
      setThemeState(event.matches ? "dark" : "light");
    updateSystemTheme(mediaQuery);
    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, [followsSystem]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setFollowsSystem(false);
    setThemeState(nextTheme);
    getThemeStorage()?.setItem(themeStorageKey, nextTheme);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
