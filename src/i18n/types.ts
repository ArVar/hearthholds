export const supportedLocales = ["de", "en"] as const;
export type Locale = (typeof supportedLocales)[number];
export type LocalizedText = Record<Locale, string>;
