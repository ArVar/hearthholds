import { GridSettingsPanel } from "./GridSettingsPanel";
import { InspectorPanel } from "./InspectorPanel";
import { PreferencesPanel } from "./PreferencesPanel";
import { SceneBrowserPanel } from "./SceneBrowserPanel";

export type RightPanel = "inspector" | "scene" | "grid" | "settings";

export function RightSidebar({
  panel,
  onClosePanel,
}: {
  panel: RightPanel;
  onClosePanel: () => void;
}) {
  if (panel === "grid") return <GridSettingsPanel onClose={onClosePanel} />;
  if (panel === "settings") return <PreferencesPanel onClose={onClosePanel} />;
  if (panel === "scene") return <SceneBrowserPanel onClose={onClosePanel} />;
  return <InspectorPanel />;
}
