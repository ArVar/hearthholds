import { BadgeInfo, Database, Globe2, Moon, Settings2, Sun, X } from "lucide-react";
import { appVersion, fullProductName } from "../config/brand";
import { currentSchemaVersion } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";
import { supportedLocales, type Locale } from "../i18n/types";
import { useTheme, type Theme } from "../theme/ThemeProvider";
import { IconButton } from "./IconButton";

const themeOptions = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
] satisfies { value: Theme; Icon: typeof Sun }[];

export function PreferencesPanel({ onClose }: { onClose: () => void }) {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="inspector preferences-panel" aria-label={t("top.settings")}>
      <div className="inspector-header">
        <div className="object-type-icon">
          <Settings2 size={19} />
        </div>
        <div>
          <span>{t("panel.application")}</span>
          <strong>{t("top.settings")}</strong>
        </div>
        <IconButton label={t("common.close")} onClick={onClose}>
          <X size={17} />
        </IconButton>
      </div>
      <div className="inspector-scroll">
        <section className="form-section">
          <h2>{t("top.language")}</h2>
          <div className="settings-choice-grid" role="group" aria-label={t("top.language")}>
            {supportedLocales.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={locale === candidate ? "is-active" : undefined}
                aria-pressed={locale === candidate}
                onClick={() => setLocale(candidate as Locale)}
              >
                <Globe2 size={17} />
                <span>{t(`language.${candidate}`)}</span>
                <strong>{candidate.toUpperCase()}</strong>
              </button>
            ))}
          </div>
        </section>
        <section className="form-section">
          <h2>{t("top.theme")}</h2>
          <div className="settings-choice-grid" role="group" aria-label={t("top.theme")}>
            {themeOptions.map(({ value, Icon }) => (
              <button
                key={value}
                type="button"
                className={theme === value ? "is-active" : undefined}
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                <Icon size={17} />
                <span>{t(`theme.${value}`)}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="form-section app-info-section">
          <h2>
            <BadgeInfo size={15} /> {t("settings.about")}
          </h2>
          <strong>{fullProductName}</strong>
          <div className="app-version-grid">
            <span>
              <span>{t("settings.appVersion")}</span>
              <strong>{appVersion}</strong>
            </span>
            <span>
              <span>{t("settings.schemaVersion")}</span>
              <strong>{currentSchemaVersion}</strong>
            </span>
          </div>
        </section>
        <section className="form-section app-legal-section">
          <h2>
            <Database size={15} /> {t("settings.dataAndLicenses")}
          </h2>
          <p>{t("settings.localDataNotice")}</p>
          <p>
            This work includes material taken from the System Reference Document 5.1
            ("SRD 5.1") by Wizards of the Coast LLC and available at{" "}
            <a href="https://dnd.wizards.com/resources/systems-reference-document" target="_blank" rel="noreferrer">
              https://dnd.wizards.com/resources/systems-reference-document
            </a>
            . The SRD 5.1 is licensed under the{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">
              Creative Commons Attribution 4.0 International License available at
              https://creativecommons.org/licenses/by/4.0/legalcode
            </a>
            .
          </p>
        </section>
      </div>
    </aside>
  );
}
