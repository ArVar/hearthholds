import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fullProductName } from "../config/brand";
import { englishMessages, germanMessages, type TranslationKey } from "./messages";
import { supportedLocales, type Locale, type LocalizedText } from "./types";

export type TranslationParameters = Record<string, string | number>;
export type Translate = (
  key: TranslationKey,
  parameters?: TranslationParameters,
) => string;

const localeStorageKey = "pnp-settlement.locale";
const messages = { de: germanMessages, en: englishMessages };

function isLocale(value: string | null | undefined): value is Locale {
  return supportedLocales.includes(value as Locale);
}

function getLocaleStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function detectLocale(): Locale {
  const storedLocale = getLocaleStorage()?.getItem(localeStorageKey);
  if (isLocale(storedLocale)) return storedLocale;

  const browserLocale = window.navigator.languages
    .map((locale) => locale.split("-")[0])
    .find(isLocale);
  return browserLocale ?? "de";
}

function interpolate(message: string, parameters?: TranslationParameters): string {
  if (!parameters) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in parameters ? String(parameters[name]) : match,
  );
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  localize: (text: LocalizedText) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(detectLocale);

  useEffect(() => {
    getLocaleStorage()?.setItem(localeStorageKey, locale);
    document.documentElement.lang = locale;
    document.title = fullProductName;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", messages[locale]["app.description"]);
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, parameters?: TranslationParameters) =>
      interpolate(messages[locale][key], parameters),
    [locale],
  );
  const localize = useCallback((text: LocalizedText) => text[locale], [locale]);
  const value = useMemo(
    () => ({ locale, setLocale, t, localize }),
    [locale, localize, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider.");
  return context;
}
