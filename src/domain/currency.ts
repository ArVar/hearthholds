import type { EditorDocument } from "./types";

export type CurrencyDefinition = {
  id: string;
  label: { de: string; en: string };
  symbol: string;
  baseUnits: number;
};

export type CurrencyProfile = {
  id: string;
  denominations: CurrencyDefinition[];
  defaultDisplayCurrencyId: string;
  defaultWageCurrencyId: string;
  defaultIncomeCurrencyId: string;
};

const dnd5eCurrencyProfile: CurrencyProfile = {
  id: "dnd5e",
  denominations: [
    { id: "pp", label: { de: "Platin", en: "Platinum" }, symbol: "PP", baseUnits: 1_000 },
    { id: "gp", label: { de: "Gold", en: "Gold" }, symbol: "GP", baseUnits: 100 },
    { id: "ep", label: { de: "Elektrum", en: "Electrum" }, symbol: "EP", baseUnits: 50 },
    { id: "sp", label: { de: "Silber", en: "Silver" }, symbol: "SP", baseUnits: 10 },
    { id: "cp", label: { de: "Kupfer", en: "Copper" }, symbol: "CP", baseUnits: 1 },
  ],
  defaultDisplayCurrencyId: "gp",
  defaultWageCurrencyId: "sp",
  defaultIncomeCurrencyId: "gp",
};

const genericCurrencyProfile: CurrencyProfile = {
  id: "generic",
  denominations: [
    { id: "coin", label: { de: "Münzen", en: "Coins" }, symbol: "M", baseUnits: 1 },
  ],
  defaultDisplayCurrencyId: "coin",
  defaultWageCurrencyId: "coin",
  defaultIncomeCurrencyId: "coin",
};

export function getCurrencyProfile(ruleset: string): CurrencyProfile {
  return /d\s*&\s*d|dungeons\s*&\s*dragons/i.test(ruleset)
    ? dnd5eCurrencyProfile
    : genericCurrencyProfile;
}

export function getCurrencyDefinition(
  ruleset: string,
  currencyId: string,
): CurrencyDefinition {
  const profile = getCurrencyProfile(ruleset);
  return profile.denominations.find((entry) => entry.id === currencyId)
    ?? profile.denominations.find(
      (entry) => entry.id === profile.defaultDisplayCurrencyId,
    )!;
}

export function toBaseCurrency(
  ruleset: string,
  amount: number,
  currencyId: string,
): number {
  return Math.max(0, Math.round(
    amount * getCurrencyDefinition(ruleset, currencyId).baseUnits,
  ));
}

export function fromBaseCurrency(
  ruleset: string,
  baseUnits: number,
  currencyId: string,
): number {
  return baseUnits / getCurrencyDefinition(ruleset, currencyId).baseUnits;
}

export function formatBaseCurrency(
  ruleset: string,
  baseUnits: number,
  highestCurrencyId?: string,
): string {
  const profile = getCurrencyProfile(ruleset);
  const highestCurrencyIndex = highestCurrencyId
    ? profile.denominations.findIndex((entry) => entry.id === highestCurrencyId)
    : 0;
  const denominations = profile.denominations.slice(
    highestCurrencyIndex >= 0 ? highestCurrencyIndex : 0,
  );
  let remaining = Math.max(0, Math.round(baseUnits));
  const parts: string[] = [];
  for (const denomination of denominations) {
    const amount = Math.floor(remaining / denomination.baseUnits);
    if (amount > 0) {
      parts.push(`${amount} ${denomination.symbol}`);
      remaining -= amount * denomination.baseUnits;
    }
  }
  return parts.join(" · ") || `0 ${denominations[0]?.symbol ?? getCurrencyDefinition(
    ruleset,
    profile.defaultDisplayCurrencyId,
  ).symbol}`;
}

export function getLegacyCurrencyId(ruleset: string, currency: unknown): string {
  const profile = getCurrencyProfile(ruleset);
  if (typeof currency === "string") {
    const normalized = currency.toLowerCase();
    const match = profile.denominations.find(
      (entry) =>
        entry.id === normalized
        || entry.symbol.toLowerCase() === normalized
        || entry.label.de.toLowerCase() === normalized
        || entry.label.en.toLowerCase() === normalized,
    );
    if (match) return match.id;
  }
  return profile.defaultWageCurrencyId;
}

export function getTreasuryDisplayAmount(document: EditorDocument): number {
  return fromBaseCurrency(
    document.ruleset,
    document.treasury.balanceBaseUnits,
    document.treasury.displayCurrencyId,
  );
}
