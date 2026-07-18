import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "./I18nProvider";

function LanguageHarness() {
  const { locale, setLocale, t } = useI18n();
  return (
    <>
      <span>{t("palette.newBuilding", { type: "Forge" })}</span>
      <button type="button" onClick={() => setLocale(locale === "de" ? "en" : "de")}>
        {t("top.language")}
      </button>
    </>
  );
}

describe("internationalization", () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };

  beforeEach(() => {
    values.clear();
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  });
  afterEach(cleanup);

  it("loads a persisted locale and interpolates translated values", () => {
    window.localStorage.setItem("pnp-settlement.locale", "de");
    render(
      <I18nProvider>
        <LanguageHarness />
      </I18nProvider>,
    );

    expect(screen.getByText("Neues Forge")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("de");
    expect(document.title).toBe("Hearthholds: Living Places");
  });

  it("switches language without reloading and persists the selection", () => {
    window.localStorage.setItem("pnp-settlement.locale", "de");
    render(
      <I18nProvider>
        <LanguageHarness />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sprache" }));

    expect(screen.getByText("New Forge")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem("pnp-settlement.locale")).toBe("en");
  });
});
