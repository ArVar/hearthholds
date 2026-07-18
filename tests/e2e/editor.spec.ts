import { expect, test, type Page } from "@playwright/test";

async function openSceneBrowser(page: Page) {
  const browser = page.getByRole("complementary", { name: "Objekte und Ebenen" });
  if (!(await browser.isVisible())) {
    await page.getByRole("button", { name: "Objekte und Ebenen" }).click();
  }
  await expect(browser).toBeVisible();
  return browser;
}

async function selectSceneObject(page: Page, name: string) {
  const browser = await openSceneBrowser(page);
  await browser.locator(".scene-object-row").filter({ hasText: name }).click();
  await page.getByRole("button", { name: "Objekte und Ebenen" }).click();
}

async function exportCurrentDocument(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("pnp-settlement.locale")) {
      localStorage.setItem("pnp-settlement.locale", "de");
    }
  });
  await page.goto("./");
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("pnp-settlement");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
});

test("exposes the Hearthholds product identity", async ({ page }) => {
  await expect(page).toHaveTitle("Hearthholds: Living Places");
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute(
    "content",
    "Hearthholds",
  );
  const brandMark = page.getByRole("img", { name: "Hearthholds: Living Places" });
  await expect(brandMark).toBeVisible();
  await expect(brandMark.locator("img")).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute(
    "href",
    /\/assets\/hearthholds-icon-32(?:-[^/.]+)?\.png$/,
  );
  const identity = page.locator(".brand-identity");
  await expect(identity).toContainText("Hearthholds");
  await expect(identity).toContainText("Living Places");

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifestResponse = await page.request.get(manifestHref!);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "Hearthholds: Living Places",
    short_name: "Hearthholds",
    display: "standalone",
    start_url: "./",
    scope: "./",
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ sizes: "512x512", type: "image/png" }),
  ]));
});

test("offers installation through the browser install prompt", async ({ page }) => {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt?: () => Promise<void>;
      userChoice?: Promise<{ outcome: "accepted"; platform: string }>;
    };
    event.prompt = async () => {
      document.body.dataset.installPrompted = "true";
    };
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
  });

  await expect(page.getByText(
    "Hearthholds kann als Offline-App auf diesem Gerät installiert werden.",
  )).toBeVisible();
  await page.getByRole("button", { name: "App installieren" }).click();
  await expect.poll(() => page.locator("body").getAttribute("data-install-prompted"))
    .toBe("true");
  await expect(page.getByRole("button", { name: "App installieren" })).toBeHidden();
});

test("reopens a persisted settlement with bundled assets while offline", async ({ page, context }) => {
  await expect.poll(() => page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return ready.active?.state ?? null;
  })).toBe("activated");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  const cacheSummary = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find((name) => name.startsWith("hearthholds-precache-"))!);
    return { names, entries: (await cache.keys()).length };
  });
  expect(cacheSummary.names.some((name) => name.startsWith("hearthholds-precache-"))).toBe(true);
  expect(cacheSummary.entries).toBeGreaterThan(20);

  await selectSceneObject(page, "Dorfschmiede");
  const inspector = page.locator(".inspector");
  await inspector.getByLabel("Name").fill("Offline-Schmiede");
  await inspector.getByLabel("Name").press("Tab");
  await expect(page.getByText("Lokal gespeichert", { exact: true })).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("Hearthholds: Living Places");
  const browser = await openSceneBrowser(page);
  await expect(browser.locator(".scene-object-row").filter({ hasText: "Offline-Schmiede" }))
    .toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="192x192"]');
    if (!icon) return false;
    return fetch(icon.href).then((response) => response.ok).catch(() => false);
  })).toBe(true);
  await context.setOffline(false);
});

test("switches and persists the application language", async ({ page }) => {
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await page.getByRole("button", { name: /English.*EN/ }).click();

  await expect(page.getByRole("tab", { name: "Objects" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search object catalog" }).fill("Cottage");
  await expect(page.getByRole("button", { name: "Cottage", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Present" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: /English.*EN/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("uses the system appearance and persists a dark override", async ({ page }) => {
  const systemTheme = await page.evaluate(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", systemTheme);
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await expect(page.getByRole("group", { name: "Farbschema" }).getByRole("button"))
    .toHaveCount(2);
  await expect(page.getByRole("button", { name: systemTheme === "dark" ? "Dunkel" : "Hell" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Dunkel" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const appInfo = page.locator(".app-info-section");
  await expect(appInfo).toContainText("Hearthholds: Living Places");
  await expect(appInfo).toContainText("App-Version0.1.0-alpha.1");
  await expect(appInfo).toContainText("Dokument-Schema16");
  await expect(page.getByText("Deine Siedlungen bleiben in diesem Browser")).toBeVisible();
  await expect(page.getByText(/System Reference Document 5\.1/)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await expect(page.getByRole("button", { name: "Dunkel" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  const brandTheme = await page.locator(".top-bar").evaluate((element) => ({
    backgroundImage: getComputedStyle(element).backgroundImage,
    gold: getComputedStyle(document.documentElement).getPropertyValue("--brand-gold"),
  }));
  expect(brandTheme.backgroundImage).toContain("hearthholds-wood-texture-subtle");
  expect(brandTheme.gold.trim()).not.toBe("");
});

test("toggles browser fullscreen from the editor", async ({ page }) => {
  await page.getByRole("button", { name: "Vollbild öffnen" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.getByRole("button", { name: "Vollbild beenden" })).toBeVisible();

  await page.getByRole("button", { name: "Vollbild beenden" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
});

test("renders catalog thumbnails square without distorting their artwork", async ({ page }) => {
  await page
    .getByRole("searchbox", { name: "Objektkatalog durchsuchen" })
    .fill("Wohnhaus");
  const thumbnail = page
    .getByRole("button", { name: "Wohnhaus", exact: true })
    .locator(".catalog-thumbnail");
  await expect(thumbnail).toBeVisible();

  const presentation = await thumbnail.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const image = element.querySelector("img");
    return {
      width: bounds.width,
      height: bounds.height,
      objectFit: image ? getComputedStyle(image).objectFit : null,
    };
  });

  expect(Math.abs(presentation.width - presentation.height)).toBeLessThanOrEqual(1);
  expect(presentation.objectFit).toBe("contain");
});

test("places short-log and long-timber woodpile variants", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Objektkatalog durchsuchen" }).fill("Holzstapel");
  await page.getByRole("button", { name: "Holzstapel", exact: true }).click();
  const variants = page.getByRole("group", { name: "Variante auswählen" });
  await expect(variants.getByRole("button")).toHaveCount(2);
  await expect(variants.getByRole("button", { name: "Kurzholz" })).toBeVisible();
  await variants.getByRole("button", { name: "Langholz" }).click();

  await expect(page.locator(".inspector-header strong")).toHaveText("Neuer Langholzstapel");
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("timber-stack")),
      ),
    )
    .toBe(true);
});

test("selects and transforms decorations with a canvas marquee", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 1_000 });
  await page.getByRole("button", { name: "Neue leere Karte" }).click();
  const search = page.getByRole("searchbox", { name: "Objektkatalog durchsuchen" });
  await search.fill("Holzstapel");
  const woodpile = page.getByRole("button", { name: "Holzstapel", exact: true });
  await woodpile.click();
  await page.getByRole("group", { name: "Variante auswählen" })
    .getByRole("button", { name: "Kurzholz" }).click();
  await woodpile.click();
  await page.getByRole("group", { name: "Variante auswählen" })
    .getByRole("button", { name: "Langholz" }).click();
  await page.getByRole("button", { name: "Karte einpassen" }).click();

  const workspace = await page.locator(".map-workspace").boundingBox();
  if (!workspace) throw new Error("Kartenfläche nicht verfügbar");
  const scale = Math.min(
    (workspace.width - 48) / 1_365,
    (workspace.height - 48) / 768,
  );
  const screenPoint = (x: number, y: number) => ({
    x: workspace.x + (workspace.width - 1_365 * scale) / 2 + x * scale,
    y: workspace.y + (workspace.height - 768 * scale) / 2 + y * scale,
  });
  const marqueeStart = screenPoint(570, 315);
  const marqueeEnd = screenPoint(800, 455);
  await page.mouse.move(marqueeStart.x, marqueeStart.y);
  await page.mouse.down();
  await page.mouse.move(marqueeEnd.x, marqueeEnd.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("2 Objekte ausgewählt", { exact: true })).toBeVisible();

  await page.keyboard.press("r");
  const center = screenPoint(682.5, 384);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 30, center.y + 15, { steps: 5 });
  await page.mouse.up();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const decorations = exported.map.decorations;

  expect(decorations).toHaveLength(2);
  expect(decorations.map((item: { rotation: number }) => item.rotation)).toEqual([15, 15]);
  expect(decorations[0].position.x).toBeGreaterThan(682.5);
  expect(decorations[0].position).toEqual(decorations[1].position);
});

test("reorders objects by dragging them in the scene browser", async ({ page }) => {
  const browser = await openSceneBrowser(page);
  const carpenter = browser.locator(".scene-object-row").filter({ hasText: "Schreinerei" });
  const forge = browser.locator(".scene-object-row").filter({ hasText: "Dorfschmiede" });

  await carpenter.dragTo(forge, { targetPosition: { x: 30, y: 3 } });
  await page.waitForTimeout(650);
  await page.reload();

  const restoredBrowser = await openSceneBrowser(page);
  const buildingNames = await restoredBrowser
    .locator(".scene-tree-section")
    .filter({ hasText: "Gebäude" })
    .locator(".scene-object-row strong")
    .allTextContents();
  expect(buildingNames.indexOf("Schreinerei")).toBeLessThan(
    buildingNames.indexOf("Dorfschmiede"),
  );
});

test("selects, groups and locks multiple objects in the scene browser", async ({ page }) => {
  const browser = await openSceneBrowser(page);
  await browser.getByRole("button", { name: "Browser verbreitern" }).click();
  await expect.poll(async () => (await browser.boundingBox())?.width ?? 0).toBeGreaterThan(400);
  await expect.poll(async () => (await browser.boundingBox())?.width ?? 1_440).toBeLessThan(500);
  await expect
    .poll(() =>
      browser.evaluate((element) =>
        Math.abs(element.getBoundingClientRect().right - window.innerWidth),
      ),
    )
    .toBeLessThan(2);
  await browser.getByRole("button", { name: "Browser verkleinern" }).click();
  const carpenter = browser.locator(".scene-object-row").filter({ hasText: "Schreinerei" });
  const well = browser.locator(".scene-object-row").filter({ hasText: "Dorfbrunnen" });

  await carpenter.locator(".scene-object-select").click();
  await well.locator(".scene-object-select").click({ modifiers: ["Shift"] });
  await expect(carpenter).toHaveClass(/is-selected/);
  await expect(well).toHaveClass(/is-selected/);

  await browser.getByRole("button", { name: "Gruppieren", exact: true }).click();
  const group = browser.locator(".scene-tree-section.is-group").first();
  await expect(group.getByLabel("Gruppenname")).toHaveValue("Gruppe 1");
  await expect(group).toContainText("Schreinerei");
  await expect(group).toContainText("Dorfbrunnen");
  await group.getByRole("button", { name: "Gruppe sperren" }).click();
  await expect(group.getByRole("button", { name: "Gruppe entsperren" })).toBeVisible();

  await page.waitForTimeout(650);
  await page.reload();
  const restoredBrowser = await openSceneBrowser(page);
  const restoredGroup = restoredBrowser.locator(".scene-tree-section.is-group").first();
  await expect(restoredGroup.getByLabel("Gruppenname")).toHaveValue("Gruppe 1");
  await expect(restoredGroup).toContainText("Schreinerei");
  await expect(restoredGroup.getByRole("button", { name: "Gruppe entsperren" })).toBeVisible();
});

test("configures a metric grid and edits object dimensions", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Raster und Maßstab" })).toHaveCount(1);
  await page.getByRole("button", { name: "Raster und Maßstab" }).click();
  const gridSettings = page.getByRole("complementary", { name: "Raster und Maßstab" });
  const gridVisibility = gridSettings.getByLabel("Raster anzeigen");
  await expect(gridVisibility).toBeChecked();
  await gridVisibility.uncheck();
  await expect(gridVisibility).not.toBeChecked();
  await gridVisibility.check();
  const resizeAnchor = gridSettings.getByRole("group", {
    name: "Ankerpunkt der Größenänderung",
  });
  await expect(resizeAnchor.getByRole("button")).toHaveCount(9);
  await expect(resizeAnchor.getByRole("button", { name: "Mitte", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  const mapWidthLabel = gridSettings.getByText("Kartenbreite (m)", { exact: true });
  const mapWidthInput = gridSettings.getByLabel("Kartenbreite (m)");
  const [mapWidthLabelBox, mapWidthInputBox] = await Promise.all([
    mapWidthLabel.boundingBox(),
    mapWidthInput.boundingBox(),
  ]);
  expect((mapWidthLabelBox?.y ?? 0) + (mapWidthLabelBox?.height ?? 0))
    .toBeLessThanOrEqual(mapWidthInputBox?.y ?? 0);
  await expect(gridSettings).toContainText("120 × 80 m");
  await gridSettings.getByLabel("Rasterfarbe").fill("#e0b24b");
  await gridSettings.getByLabel(/Rastertransparenz/).fill("0.75");
  await expect(gridSettings.getByLabel(/Rastertransparenz/)).toHaveValue("0.75");
  await gridSettings.getByLabel("Maßstab").selectOption("5");
  await expect(gridSettings).toContainText("400 × 266,7 m");
  await gridSettings.getByLabel("Maßstab").selectOption("1.5");
  await gridSettings.getByLabel("Kartenbreite (m)").fill("90");
  await gridSettings.getByLabel("Kartenbreite (m)").press("Enter");
  await gridSettings.getByLabel("Kartenhöhe (m)").fill("45");
  await gridSettings.getByLabel("Kartenhöhe (m)").press("Enter");
  await expect(gridSettings).toContainText("90 × 45 m");
  await gridSettings.getByRole("button", { name: "Schließen" }).click();

  await selectSceneObject(page, "Dorfbrunnen");
  const inspector = page.locator(".inspector");
  await inspector.getByLabel("Breite (m)").fill("6");
  await inspector.getByLabel("Breite (m)").press("Enter");
  await expect(inspector.getByLabel("Breite (m)")).toHaveValue("6");
  await expect(inspector.getByLabel("Tiefe (m)")).toHaveValue("4.5");
  await expect(inspector.getByText("Seitenverhältnis gesperrt")).toBeVisible();

  await selectSceneObject(page, "Westlicher Wald");
  await expect(inspector.locator(".aspect-ratio-note")).toHaveCount(0);
  await expect(inspector.getByLabel("Tiefe (m)")).toHaveValue("48");
  await inspector.getByLabel("Breite (m)").fill("12");
  await inspector.getByLabel("Breite (m)").press("Enter");
  await expect(inspector.getByLabel("Tiefe (m)")).toHaveValue("48");
  await expect(inspector).toContainText("10 % · einzelne Bäume");
  await expect(inspector).toContainText("100 % · dichter Wald");
  await inspector.getByLabel("Walddichte").fill("75");
  await expect(inspector.getByLabel("Walddichte")).toHaveValue("75");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const well = exported.map.markers.find(
    (marker: { id: string }) => marker.id === "village-well",
  );
  expect(well.width).toBe(80);
  expect(well.height).toBe(60);
  const forest = exported.map.zones.find(
    (zone: { id: string }) => zone.id === "west-forest",
  );
  expect(forest.width).toBe(160);
  expect(forest.height).toBe(640);
  expect(forest.density).toBe(0.75);
  expect(exported.map.grid).toEqual({
    size: 20,
    distance: 1.5,
    unit: "m",
    majorEvery: 5,
    color: "#e0b24b",
    opacity: 0.75,
  });
  expect(exported.map.width).toBe(1_200);
  expect(exported.map.height).toBe(600);
});

test("edits Herzdorf and switches to presentation mode", async ({ page }) => {
  await expect(page.getByLabel("Arbeitsdokument")).toHaveValue("herzdorf");
  await expect(page.locator("canvas").first()).toBeVisible();

  const sceneBrowser = await openSceneBrowser(page);
  await expect(
    sceneBrowser.locator(".scene-object-row").filter({ hasText: "Dorfschmiede" }),
  ).toBeVisible();
  await expect(sceneBrowser.locator(".scene-tree-section").filter({
    hasText: "Originalskizze",
  })).toHaveCount(0);
  await page.getByRole("button", { name: "Objekte und Ebenen" }).click();

  await selectSceneObject(page, "Schreinerei");
  await expect(page.getByText("45°", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "15 Grad im Uhrzeigersinn" }).click();
  await expect(page.getByText("60°", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(page.getByText("45°", { exact: true })).toBeVisible();

  const editorHud = page.getByRole("region", { name: "Einwohner und Ressourcen" });
  await expect(editorHud.getByRole("button", { name: "Bevölkerung und Arbeitskräfte" })).toBeVisible();
  await expect(editorHud.getByRole("button", { name: "Holz: 30 verfügbar" })).toBeVisible();
  await expect(editorHud).not.toContainText("Holz");
  await page.getByRole("button", { name: "Präsentieren" }).click();
  await expect(page.getByRole("button", { name: "Präsentation beenden" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.getByRole("button", { name: "Vollbild beenden" })).toBeVisible();
  const presentationHud = page.getByRole("region", { name: "Einwohner und Ressourcen" });
  await expect(presentationHud.getByLabel("Bevölkerung und Arbeitskräfte")).toBeVisible();
  await expect(presentationHud.getByLabel("Holz: 30 verfügbar")).toBeVisible();
  const presentationGridToggle = page.locator(".presentation-grid-toggle");
  await expect(presentationGridToggle).toHaveAttribute("aria-pressed", "true");
  await presentationGridToggle.click();
  await expect(presentationGridToggle).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("g");
  await expect(presentationGridToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Objekte und Ebenen" })).toBeHidden();

  const presentationLayout = await page.locator(".map-workspace").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.top, width: bounds.width, viewportWidth: window.innerWidth };
  });
  expect(presentationLayout.top).toBe(50);
  expect(presentationLayout.width).toBe(presentationLayout.viewportWidth);

  await page.getByRole("button", { name: "Präsentation beenden" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await expect(page.getByRole("button", { name: "Präsentieren" })).toBeVisible();
});

test("shows resource flow hover cards and advances the cycle", async ({ page }) => {
  const hud = page.getByRole("region", { name: "Einwohner und Ressourcen" });
  const wood = hud.getByRole("button", { name: "Holz: 30 verfügbar" });

  const hudGeometry = await hud.locator(".settlement-hud-item").evaluateAll((items) =>
    items.map((item) => {
      const icon = item.querySelector(".resource-artwork")!.getBoundingClientRect();
      const value = item.querySelector("strong")!.getBoundingClientRect();
      return {
        iconWidth: icon.width,
        iconHeight: icon.height,
        iconCenter: icon.left + icon.width / 2,
        valueCenter: value.left + value.width / 2,
        iconBottom: icon.bottom,
        valueTop: value.top,
      };
    }),
  );
  expect(new Set(hudGeometry.map(({ iconWidth, iconHeight }) => `${iconWidth}x${iconHeight}`)).size)
    .toBe(1);
  for (const item of hudGeometry) {
    expect(Math.abs(item.iconCenter - item.valueCenter)).toBeLessThanOrEqual(1);
    expect(item.valueTop).toBeGreaterThanOrEqual(item.iconBottom);
  }

  await hud.getByRole("button", { name: "Bevölkerung und Arbeitskräfte" }).hover();
  const populationTooltip = page.getByRole("tooltip").filter({
    hasText: "Bevölkerung und Arbeitskräfte",
  });
  await expect(populationTooltip).toContainText("freie Arbeitskräfte");
  await expect(populationTooltip).toContainText("Einwohner");

  await page.keyboard.press("Escape");
  await expect(populationTooltip).toBeHidden();
  await hud.getByRole("button", { name: "Schatzkammer" }).hover();
  const treasuryTooltip = page.getByRole("tooltip").filter({ hasText: "Schatzkammer" });
  await expect(treasuryTooltip).toContainText("Einnahmen");
  await expect(treasuryTooltip).toContainText("Bilanz je Zyklus");

  await page.keyboard.press("Escape");
  await expect(treasuryTooltip).toBeHidden();
  await expect(wood.locator(".resource-artwork.is-wood")).toBeVisible();
  await expect(wood).not.toContainText("Holz");

  await wood.hover();
  const hoverCard = page.getByRole("tooltip").filter({ hasText: "Holz" });
  await expect(hoverCard).toContainText("Erzeugung");
  await expect(hoverCard).toContainText("Umliegender Wald");
  await expect(hoverCard).toContainText("+4");
  await expect(hoverCard).toContainText("Verbrauch");
  await expect(hoverCard).toContainText("Dorfschmiede errichten");
  await expect(hoverCard).toContainText("−4");

  await wood.click();
  const resourcesPanel = page.getByRole("main", {
    name: "Ressourcen und Quellen",
  });
  await expect(resourcesPanel).toBeVisible();
  await expect(resourcesPanel.getByText("Umliegender Wald", { exact: true })).toBeVisible();
  const sourceArtwork = resourcesPanel.locator(".resource-source-artwork img").first();
  await expect(sourceArtwork).toBeVisible();
  await expect
    .poll(() => sourceArtwork.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(resourcesPanel.getByText("Zyklus 0", { exact: true })).toBeVisible();
  await expect(resourcesPanel.getByText("1 Zyklus/Zyklen", { exact: true })).toBeVisible();

  await resourcesPanel.getByRole("button", { name: "Nächster Zyklus" }).click();
  await expect(resourcesPanel.getByText("Zyklus 1", { exact: true })).toBeVisible();
  await expect(hud.getByRole("button", { name: "Holz: 34 verfügbar" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  expect(exported.campaignCycle).toBe(1);
  expect(exported.projects[0].currentStage).toBe("completion");
  expect(exported.resources.find((resource: { id: string }) => resource.id === "stone"))
    .toMatchObject({ total: 13, reserved: 0 });
});

test("adds and edits external resource source cards", async ({ page }) => {
  const hud = page.getByRole("region", { name: "Einwohner und Ressourcen" });
  await hud.getByRole("button", { name: "Holz: 30 verfügbar" }).click();
  const resourcesPanel = page.getByRole("main", {
    name: "Ressourcen und Quellen",
  });

  await resourcesPanel.getByRole("button", { name: "Eisenerzmine" }).click();
  const mineCard = resourcesPanel.locator(".resource-source-card").filter({
    hasText: "Eisenerzmine",
  }).last();
  await expect(mineCard).toBeVisible();
  const ironMining = hud.getByRole("button", {
    name: "Bergbau: 0 verfügbar",
  });
  await expect(ironMining).toBeVisible();
  await ironMining.hover();
  await expect(page.locator(".resource-category-tooltip")).toContainText("Eisenerz");
  await expect(page.locator(".resource-category-tooltip")).not.toContainText("Kupfererz");

  await mineCard.getByText("Quellenkarte bearbeiten").click();
  await mineCard.getByLabel("Maximalproduktion").fill("7");
  await mineCard.getByLabel("Transport").fill("6");
  await mineCard.getByRole("spinbutton", { name: "Tagelöhner", exact: true }).fill("2");
  await expect(mineCard.getByText("Eingeschränkt", { exact: true })).toBeVisible();

  await resourcesPanel.getByRole("button", { name: "Kupfermine" }).click();
  const copperCard = resourcesPanel.locator(".resource-source-card").filter({
    hasText: "Kupfermine",
  });
  await expect(copperCard).toBeVisible();
  await expect.poll(() => copperCard.locator("img").evaluate(
    (image: HTMLImageElement) => image.naturalWidth,
  )).toBeGreaterThan(0);

  await resourcesPanel.getByRole("button", { name: "Goldmine" }).click();
  const goldCard = resourcesPanel.locator(".resource-source-card").filter({
    hasText: "Goldmine",
  });
  await expect(goldCard).toBeVisible();
  await expect.poll(() => goldCard.locator("img").evaluate(
    (image: HTMLImageElement) => image.naturalWidth,
  )).toBeGreaterThan(0);

  const completeMining = hud.getByRole("button", {
    name: "Bergbau: 0 verfügbar",
  });
  await completeMining.hover();
  const miningTooltip = page.locator(".resource-category-tooltip");
  await expect(miningTooltip).toContainText("Eisenerz");
  await expect(miningTooltip).toContainText("Kupfererz");
  await expect(miningTooltip).toContainText("Golderz");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const mine = exported.resourceSources.find(
    (source: { type: string; maxProduction: number }) =>
      source.type === "ironMine" && source.maxProduction === 7,
  );

  expect(exported.resources.map((resource: { id: string }) => resource.id))
    .toEqual(expect.arrayContaining(["ironOre", "copperOre", "goldOre"]));
  expect(mine).toMatchObject({
    resourceId: "ironOre",
    enabled: true,
    maxProduction: 7,
    transportCapacity: 6,
    workforce: {
      minWorkers: 2,
      maxWorkers: 6,
      residentWorkers: 0,
      hiredWorkers: 2,
      wagePerCycle: 0.1,
      wageCurrencyId: "gp",
    },
  });
});

test("persists template edits and keeps document copies independent", async ({ page }) => {
  const documentSelect = page.getByLabel("Arbeitsdokument");
  await expect(documentSelect).toHaveValue("herzdorf");
  await expect(documentSelect.locator("option")).toHaveText(["Herzdorf (Template)"]);
  await expect(page.locator(".template-warning")).toContainText(
    "Änderungen werden automatisch als lokale Version gespeichert",
  );
  await expect(page.getByRole("button", { name: "Als Kopie speichern" })).toBeVisible();

  await selectSceneObject(page, "Dorfschmiede");
  const inspector = page.locator(".inspector");
  await inspector.getByLabel("Name").fill("Template-Schmiede");
  await inspector.getByLabel("Name").press("Tab");
  await expect(page.getByText("Speichert …", { exact: true })).toBeVisible();
  await expect(page.getByText("Lokal gespeichert", { exact: true })).toBeVisible();

  await page.reload();
  await expect(
    (await openSceneBrowser(page)).locator(".scene-object-row").filter({
      hasText: "Template-Schmiede",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Objekte und Ebenen" }).click();
  await page.getByRole("button", { name: "Als Kopie bearbeiten" }).click();
  await expect(documentSelect).not.toHaveValue("herzdorf");
  const copyId = await documentSelect.inputValue();
  await expect(documentSelect.locator("option")).toHaveText([
    "Herzdorf (Template)",
    "Herzdorf - Kopie",
  ]);

  await selectSceneObject(page, "Template-Schmiede");
  await inspector.getByLabel("Name").fill("Kopie-Schmiede");
  await inspector.getByLabel("Name").press("Tab");
  await expect(page.getByText("Speichert …", { exact: true })).toBeVisible();

  await documentSelect.selectOption("herzdorf");
  await expect(
    (await openSceneBrowser(page)).locator(".scene-object-row").filter({
      hasText: "Template-Schmiede",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Objekte und Ebenen" }).click();
  await documentSelect.selectOption(copyId);
  await expect(
    (await openSceneBrowser(page)).locator(".scene-object-row").filter({
      hasText: "Kopie-Schmiede",
    }),
  ).toBeVisible();

  await page.reload();
  await expect(documentSelect).toHaveValue(copyId);
  await expect(
    (await openSceneBrowser(page)).locator(".scene-object-row").filter({
      hasText: "Kopie-Schmiede",
    }),
  ).toBeVisible();
});

test("keeps failed autosaves dirty and allows a retry", async ({ page }) => {
  await expect(page.getByText("Lokal gespeichert", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype;
    (window as any).__hearthholdsOriginalPut = prototype.put;
    prototype.put = function () {
      throw new DOMException("storage full", "QuotaExceededError");
    };
  });

  await selectSceneObject(page, "Dorfschmiede");
  await page.locator(".inspector").getByLabel("Name").fill("Ungespeicherte Schmiede");
  await page.locator(".inspector").getByLabel("Name").press("Tab");

  const warning = page.getByRole("alert");
  await expect(warning).toContainText("Der lokale Speicher ist voll");
  await expect(page.getByText("Speichern fehlgeschlagen", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as any).__hearthholdsOriginalPut;
    delete (window as any).__hearthholdsOriginalPut;
  });
  await warning.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(page.getByText("Lokal gespeichert", { exact: true })).toBeVisible();
});

test("keeps unreadable local documents available for raw recovery", async ({ page }) => {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("pnp-settlement");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("documents", "readwrite");
      transaction.objectStore("documents").put({
        id: "damaged-map",
        document: {
          schemaVersion: 999,
          settlementName: "Beschädigte Karte",
          ruleset: "D&D 5e",
        },
        updatedAt: Date.now(),
        kind: "settlement",
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  const documentSelect = page.getByLabel("Arbeitsdokument");
  await expect(documentSelect.locator('option[value="damaged-map"]'))
    .toHaveText("⚠ Beschädigte Karte");
  await documentSelect.selectOption("damaged-map");
  const dialog = page.getByRole("dialog", { name: "Dokument kann nicht geöffnet werden" });
  await expect(dialog).toContainText("bleibt gespeichert");

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Rohdaten exportieren" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("damaged-map.recovery.json");
});

test("imports a validated JSON document and activates it", async ({ page }) => {
  const imported = await exportCurrentDocument(page);
  imported.id = "imported-settlement";
  imported.settlementName = "Importdorf";
  imported.map.buildings[0].name = "Importiertes Wohnhaus";

  await page.locator('input[type="file"][aria-label="Siedlung aus JSON importieren"]')
    .setInputFiles({
      name: "importdorf.schema-v16.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imported)),
    });

  await expect(page.getByLabel("Arbeitsdokument")).toHaveValue("imported-settlement");
  await expect(page.getByLabel("Arbeitsdokument").locator("option:checked"))
    .toHaveText("Importdorf");
  await page.reload();
  await expect(page.getByLabel("Arbeitsdokument")).toHaveValue("imported-settlement");
  const exportedAgain = await exportCurrentDocument(page);
  expect(exportedAgain.map.buildings[0].name).toBe("Importiertes Wohnhaus");
});

test("offers copy and explicit template replacement for import conflicts", async ({ page }) => {
  const imported = await exportCurrentDocument(page);
  imported.settlementName = "Herzdorf aus Datei";

  const importInput = page.locator(
    'input[type="file"][aria-label="Siedlung aus JSON importieren"]',
  );
  await importInput.setInputFiles({
    name: "herzdorf.schema-v16.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });

  const dialog = page.getByRole("dialog", { name: "Dokument bereits vorhanden" });
  await expect(dialog).toContainText("Das vorhandene Dokument ist ein Template");
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Arbeitsdokument")).toHaveValue("herzdorf");

  await importInput.setInputFiles({
    name: "herzdorf.schema-v16.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await dialog.getByRole("button", { name: "Als Kopie importieren" }).click();
  await expect(page.getByLabel("Arbeitsdokument").locator("option:checked"))
    .toHaveText("Herzdorf aus Datei - Kopie");

  await page.getByLabel("Arbeitsdokument").selectOption("herzdorf");
  await expect(page.getByLabel("Arbeitsdokument")).toHaveValue("herzdorf");
  await importInput.setInputFiles({
    name: "herzdorf.schema-v16.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page.getByRole("dialog", { name: "Dokument bereits vorhanden" })
    .getByRole("button", { name: "Lokale Version ersetzen" })
    .click();
  await expect(page.getByLabel("Arbeitsdokument")).toHaveValue("herzdorf");
  await expect(page.getByLabel("Arbeitsdokument").locator("option:checked"))
    .toHaveText("Herzdorf aus Datei (Template)");
});

test("reports invalid JSON imports without changing the active document", async ({ page }) => {
  await page.locator('input[type="file"][aria-label="Siedlung aus JSON importieren"]')
    .setInputFiles({
      name: "kaputt.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    });

  const dialog = page.getByRole("dialog", { name: "Import nicht möglich" });
  await expect(dialog).toContainText("Die Datei enthält kein gültiges JSON");
  await dialog.locator("footer").getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByLabel("Arbeitsdokument")).toHaveValue("herzdorf");
});

test("creates and persists a blank map document", async ({ page }) => {
  const documentSelect = page.getByLabel("Arbeitsdokument");
  await page.getByRole("button", { name: "Neue leere Karte" }).click();

  await expect(documentSelect).not.toHaveValue("herzdorf");
  const blankId = await documentSelect.inputValue();
  await expect(documentSelect.locator("option")).toHaveText([
    "Herzdorf (Template)",
    "Neue Siedlung",
  ]);
  await expect(page.locator(".template-warning")).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  expect(exported.map.buildings).toEqual([]);
  expect(exported.map.palisades).toEqual([]);
  expect(exported.map.zones).toEqual([]);
  expect(exported.map.paths).toEqual([]);
  expect(exported.map.markers).toEqual([]);
  expect(exported.map.decorations).toEqual([]);
  expect(exported.map.terrainStrokes).toEqual([]);
  expect(exported.projects).toEqual([]);

  await page.reload();
  await expect(documentSelect).toHaveValue(blankId);
  await expect(documentSelect.locator("option")).toHaveText([
    "Herzdorf (Template)",
    "Neue Siedlung",
  ]);
});

test("renders a non-empty map canvas", async ({ page }) => {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();

  const hasPaintedPixels = await canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("2d");
    if (!context) return false;
    const { width, height } = element as HTMLCanvasElement;
    const pixels = context.getImageData(0, 0, width, height).data;
    for (let index = 3; index < pixels.length; index += 4 * 97) {
      if (pixels[index] > 0) return true;
    }
    return false;
  });

  expect(hasPaintedPixels).toBe(true);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const resources = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name);
        return ["base-01", "base-02", "base-03", "tree-atlas", "bridge", "ground-", "river-", "road-", "well", "fire-pit", "wheat-field", "pasture", "village-utility"].every((asset) =>
          resources.some((resource) => resource.includes(asset)),
        );
      }),
    )
    .toBe(true);
});

test("pans the map with right-drag and trackpad-style wheel input", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 1_000 });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Karte einpassen" }).click();

  const workspace = await page.locator(".map-workspace").boundingBox();
  if (!workspace) throw new Error("Kartenfläche nicht verfügbar");
  const scale = Math.min(
    (workspace.width - 48) / 1_600,
    (workspace.height - 48) / (3_200 / 3),
  );
  const screenPoint = (x: number, y: number) => ({
    x: workspace.x + (workspace.width - 1_600 * scale) / 2 + x * scale,
    y: workspace.y + (workspace.height - (3_200 / 3) * scale) / 2 + y * scale,
  });
  const well = screenPoint(500, 480);
  const panStart = screenPoint(1_400, 100);
  const initialViewport = {
    x: Number(await page.locator(".map-workspace").getAttribute("data-viewport-x")),
    y: Number(await page.locator(".map-workspace").getAttribute("data-viewport-y")),
  };

  await page.mouse.move(panStart.x, panStart.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(panStart.x + 40, panStart.y + 20, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await expect.poll(async () =>
    Number(await page.locator(".map-workspace").getAttribute("data-viewport-x")),
  ).toBeCloseTo(initialViewport.x + 40, 0);
  await page.mouse.click(well.x + 40, well.y + 20);
  await expect(page.locator(".inspector-header strong")).toHaveText("Dorfbrunnen");

  await page.keyboard.press("Escape");
  await page.mouse.move(workspace.x + workspace.width / 2, workspace.y + workspace.height / 2);
  await page.mouse.wheel(40, 20);
  await expect.poll(async () =>
    Number(await page.locator(".map-workspace").getAttribute("data-viewport-x")),
  ).toBeCloseTo(initialViewport.x, 0);
  await expect.poll(async () =>
    Number(await page.locator(".map-workspace").getAttribute("data-viewport-y")),
  ).toBeCloseTo(initialViewport.y, 0);
});

test("paints persistent terrain with a metric brush", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 1_000 });
  await page.getByRole("tab", { name: "Gelände" }).click();
  await page.getByRole("button", { name: "Erde", exact: true }).click();
  await page.getByLabel("Pinselgröße").selectOption("12");

  const workspace = await page.locator(".map-workspace").boundingBox();
  if (!workspace) throw new Error("Kartenfläche nicht verfügbar");
  await page.mouse.click(workspace.x + 8, workspace.y + 8);
  await page.mouse.move(workspace.x + workspace.width * 0.42, workspace.y + workspace.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(
    workspace.x + workspace.width * 0.58,
    workspace.y + workspace.height * 0.56,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Rückgängig" })).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  expect(exported.map.terrainStrokes).toHaveLength(5);
  expect(exported.map.terrainStrokes.at(-1)).toMatchObject({ type: "dirt", width: 160 });
  expect(exported.map.terrainStrokes.at(-1).points.length).toBeGreaterThan(4);
});

test("switches residential variants and operational upgrade tiers", async ({ page }) => {
  await selectSceneObject(page, "Wohnhaus am Waldrand");
  const variant = page.getByLabel("Darstellung");
  await expect(variant).toHaveValue("01");
  await variant.selectOption("03");
  await expect(variant).toHaveValue("03");
  await page.getByLabel("Status").selectOption("damaged");
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("building-damage")),
      ),
    )
    .toBe(true);

  await selectSceneObject(page, "Schreinerei");
  const upgradeTier = page.getByLabel("Ausbaustufe");
  await expect(upgradeTier).toHaveValue("base");
  await upgradeTier.selectOption("master");
  await expect(upgradeTier).toHaveValue("master");
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("master-")),
      ),
    )
    .toBe(true);
});

test("configures extended farmhouse grain and hops production", async ({ page }) => {
  const hud = page.getByRole("region", { name: "Einwohner und Ressourcen" });
  const baseAgriculture = hud.getByRole("button", {
    name: "Landwirtschaft: 0 verfügbar",
  });
  await expect(baseAgriculture).toBeVisible();
  await baseAgriculture.hover();
  await expect(page.locator(".resource-category-tooltip")).toContainText("Getreide");
  await expect(page.locator(".resource-category-tooltip")).not.toContainText("Hopfen");
  await selectSceneObject(page, "Bernds Bauernhof");
  const upgradeTier = page.getByLabel("Ausbaustufe");
  await upgradeTier.selectOption("extended");

  const extendedAgriculture = hud.getByRole("button", {
    name: "Landwirtschaft: 0 verfügbar",
  });
  await expect(extendedAgriculture).toBeVisible();
  await extendedAgriculture.hover();
  await expect(page.locator(".resource-category-tooltip")).toContainText("Getreide");
  await expect(page.locator(".resource-category-tooltip")).toContainText("Hopfen");
  await expect(page.getByLabel("Maximalbesetzung")).toHaveValue("9");
  await expect(page.getByLabel("Maximalproduktion")).toHaveValue("16");
  const residentWorkers = page.getByRole("spinbutton", {
    name: "Einheimische Arbeiter",
  });
  await expect(residentWorkers).toHaveAttribute("max", "4");
  await residentWorkers.fill("4");
  await expect(residentWorkers).toHaveValue("4");
  await expect(page.getByText("Eingeschränkt", { exact: true })).toBeVisible();
  const shares = page.getByLabel("Anteil");
  await expect(shares).toHaveCount(2);
  await expect(shares.nth(0)).toHaveValue("75");
  await expect(shares.nth(1)).toHaveValue("25");

  await shares.nth(0).fill("60");
  await expect(shares.nth(1)).toHaveValue("40");

  await extendedAgriculture.click();
  const resourcesPanel = page.getByRole("main", { name: "Ressourcen und Quellen" });
  await expect(resourcesPanel.getByText("Einnahmen").first()).toBeVisible();
  await expect(resourcesPanel.getByText("+2 GP", { exact: true }).first()).toBeVisible();
  await resourcesPanel.getByRole("button", { name: "Nächster Zyklus" }).click();
  await expect(hud.getByRole("button", {
    name: "Landwirtschaft: 6 verfügbar",
  })).toBeVisible();
  await expect(resourcesPanel.getByText("102 GP", { exact: true })).toBeVisible();
});

test("calculates, consumes and reserves construction phase resources", async ({ page }) => {
  const project = page.locator(".project-section");

  await expect(page.getByLabel("Ausbaustufe")).toBeEnabled();

  await expect
    .poll(() =>
      page.evaluate(() =>
        performance.getEntriesByType("resource").some((entry) =>
          entry.name.includes("masonry"),
        ),
      ),
    )
    .toBe(true);

  await expect(project.getByText("Mauerwerk", { exact: true })).toBeVisible();
  await expect(project.getByText("12 Einheiten reserviert", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "15 Grad im Uhrzeigersinn" }).click();
  await expect(page.getByText("60°", { exact: true })).toBeVisible();
  await project.getByRole("button", { name: "Phase abschließen" }).click();

  await expect(project.getByText("Dach & Fertigstellung", { exact: true }).first()).toBeVisible();
  const browser = await openSceneBrowser(page);
  await expect(
    browser.locator(".scene-object-row").filter({ hasText: "Dorfschmiede" }),
  ).toContainText("Dach & Fertigstellung · 0%");
  await page.getByRole("button", { name: "Objekte und Ebenen" }).click();
  await expect(project.getByText("16 benötigt · 30 verfügbar", { exact: true })).toBeVisible();
  await page.getByLabel("Schmied verfügbar").check();
  await project.getByRole("button", { name: "Bedarf reservieren" }).click();
  await expect(project.getByText("16 Einheiten reserviert", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(project.getByRole("button", { name: "Bedarf reservieren" })).toBeVisible();
});

test("exports the complete settlement definition as JSON", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("herzdorf.schema-v16.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  expect(exported.schemaVersion).toBe(16);
  expect(exported.map.buildings).toHaveLength(11);
  expect(exported.map.decorations).toHaveLength(3);
  expect(exported.map.gates).toHaveLength(2);
  expect(exported.map.grid).toEqual({
    size: 20,
    distance: 1.5,
    unit: "m",
    majorEvery: 5,
    opacity: 0.2,
  });
  expect(Object.keys(exported.buildPlans[0].phases)).toEqual([
    "foundation",
    "masonry",
    "completion",
  ]);
  expect(exported.projects[0].buildingId).toBe("forge");
  expect(exported.map.buildings.find((building: { id: string }) => building.id === "manor")
    .assetTypeId).toBe("manor");
});

test("edits paths and creates wall infrastructure", async ({ page }) => {
  await selectSceneObject(page, "Hauptweg");
  const width = page.getByLabel("Breite");
  await expect(width).toHaveValue("20");
  await width.fill("24");
  await expect(width).toHaveValue("24");

  const geometry = page.locator(".form-section").filter({ hasText: "Kontrollpunkte" });
  await expect(geometry).toContainText("5");
  await geometry.locator(".geometry-actions button").first().click();
  await expect(geometry).toContainText("6");
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(geometry).toContainText("5");

  await page.getByRole("searchbox", { name: "Objektkatalog durchsuchen" }).fill("Befestigung");
  await page.getByRole("button", { name: "Befestigung", exact: true }).click();
  await page.getByRole("button", { name: "Steinmauer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Geometrie" })).toBeVisible();
  await expect(page.getByLabel("Bauart")).toHaveValue("wall");
  await expect(page.getByText("Neue Steinmauer", { exact: true }).first()).toBeVisible();
});

test("places and edits an independent fortification gate", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Objektkatalog durchsuchen" }).fill("Tor");
  await page.getByRole("button", { name: "Tor", exact: true }).click();
  await page.getByRole("button", { name: "Steintor", exact: true }).click();

  await expect(page.getByText("Befestigungstor", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Bauart")).toHaveValue("wall");
  await page.getByLabel("Torart").selectOption("service");
  await page.getByLabel("Name").fill("Westtor");
  await page.getByLabel("Name").blur();
  await page.getByLabel("Breite (m)").fill("6");
  await page.getByLabel("Breite (m)").blur();
  await page.getByRole("button", { name: "15 Grad im Uhrzeigersinn" }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("ArrowRight");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const gate = exported.map.gates.find(
    (candidate: { name: string }) => candidate.name === "Westtor",
  );

  expect(gate).toMatchObject({
    kind: "service",
    style: "wall",
    width: 80,
    rotation: 15,
  });
  expect(gate.position.x).toBe(exported.map.width / 2 + 20);
});

test("creates a standard construction project for catalog buildings", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Objektkatalog durchsuchen" }).fill("Bauernhof");
  await page.getByRole("button", { name: "Bauernhof", exact: true }).click();

  const project = page.locator(".project-section");
  await expect(project.getByRole("heading", { name: "Aktives Bauprojekt" })).toBeVisible();
  await expect(project.getByText("Fundament", { exact: true }).first()).toBeVisible();
  await expect(project).toContainText("Phase 1 von 3");
  await expect(project).toContainText("2 Holz");
  await expect(project).toContainText("4 Stein");
  await expect(project).toContainText("2 Arbeitskräfte");

  await project.getByRole("button", { name: "Bedarf reservieren" }).click();
  await expect(
    page.locator(".inspector").getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("construction");
});

test("updates construction and upgrade artwork when statuses change", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Objektkatalog durchsuchen" }).fill("Schreinerei");
  await page.getByRole("button", { name: "Schreinerei", exact: true }).click();

  const upgradeTier = page.getByLabel("Ausbaustufe");
  const buildingStatus = page
    .locator(".inspector")
    .getByRole("combobox", { name: "Status", exact: true });
  await expect(buildingStatus).toHaveValue("planned");
  await expect(upgradeTier).toBeEnabled();
  await upgradeTier.selectOption("master");
  await expect(upgradeTier).toHaveValue("master");

  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("foundation-")),
      ),
    )
    .toBe(true);

  await buildingStatus.selectOption("complete");
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("master-")),
      ),
    )
    .toBe(true);
});

test("selects and moves fields and map markers", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 1_000 });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Karte einpassen" }).click();

  const worldToScreen = async (x: number, y: number) => {
    const workspace = await page.locator(".map-workspace").boundingBox();
    if (!workspace) throw new Error("Kartenfläche nicht verfügbar");
    const scale = Math.min(
      (workspace.width - 48) / 1_600,
      (workspace.height - 48) / (3_200 / 3),
    );
    return {
      x: workspace.x + (workspace.width - 1_600 * scale) / 2 + x * scale,
      y: workspace.y + (workspace.height - (3_200 / 3) * scale) / 2 + y * scale,
    };
  };
  const dragWorldPoint = async (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const start = await worldToScreen(from.x, from.y);
    const end = await worldToScreen(to.x, to.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  };

  const inspector = page.locator(".inspector");
  await dragWorldPoint({ x: 1_060, y: 220 }, { x: 1_100, y: 200 });
  await expect(inspector.getByText("Kleines Weizenfeld", { exact: true })).toBeVisible();
  await expect(inspector.getByText("1100 / 200", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(inspector.getByText("1060 / 220", { exact: true })).toBeVisible();

  await dragWorldPoint({ x: 500, y: 480 }, { x: 540, y: 520 });
  await expect(inspector.getByText("Dorfbrunnen", { exact: true })).toBeVisible();
  await expect(inspector.getByText("540 / 520", { exact: true })).toBeVisible();

  await dragWorldPoint({ x: 540, y: 380 }, { x: 580, y: 420 });
  await expect(inspector.locator(".inspector-header strong")).toHaveText("Feuerstelle");
  await expect(inspector.getByText("580 / 420", { exact: true })).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(inspector.getByText("600 / 420", { exact: true })).toBeVisible();
  await page.keyboard.press("w");
  await expect(inspector.getByText("600 / 400", { exact: true })).toBeVisible();
});

test("inserts path and wall nodes from the canvas context menu", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 1_000 });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Karte einpassen" }).click();
  const clickWorldPoint = async (x: number, y: number) => {
    const workspace = await page.locator(".map-workspace").boundingBox();
    if (!workspace) throw new Error("Kartenfläche nicht verfügbar");
    const scale = Math.min(
      (workspace.width - 48) / 1_600,
      (workspace.height - 48) / (3_200 / 3),
    );
    const offsetX = (workspace.width - 1_600 * scale) / 2;
    const offsetY = (workspace.height - (3_200 / 3) * scale) / 2;
    await page.mouse.click(
      workspace.x + offsetX + x * scale,
      workspace.y + offsetY + y * scale,
      { button: "right" },
    );
  };

  await selectSceneObject(page, "Herzdorfer Palisade");
  await clickWorldPoint(817.5, 229.33333333333337);
  const smoothExistingJunction = page.getByRole("menuitemradio", {
    name: "Glatter Knoten",
  });
  await expect(smoothExistingJunction).toBeEnabled();
  await smoothExistingJunction.click();
  await expect(page.getByText("6 Segmente", { exact: true })).toBeVisible();

  await selectSceneObject(page, "Hauptweg");

  await clickWorldPoint(1_450, 895);
  await page.getByRole("menuitem", { name: "Punkt hier einfügen" }).click();
  const pathGeometry = page.locator(".form-section").filter({ hasText: "Kontrollpunkte" });
  await expect(pathGeometry).toContainText("6");

  await page.getByRole("searchbox", { name: "Objektkatalog durchsuchen" }).fill("Befestigung");
  await page.getByRole("button", { name: "Befestigung", exact: true }).click();
  await page.getByRole("button", { name: "Steinmauer", exact: true }).click();
  await expect(page.getByText("1 Segmente", { exact: true })).toBeVisible();
  await clickWorldPoint(700, 533.3333333333334);
  const smoothEndpoint = page.getByRole("menuitemradio", {
    name: "Glatter Knoten",
  });
  await expect(smoothEndpoint).toBeEnabled();
  await smoothEndpoint.click();
  await clickWorldPoint(750, 533.3333333333334);
  await page.getByRole("menuitem", { name: "Knoten hier einfügen" }).click();
  await expect(page.getByText("2 Segmente", { exact: true })).toBeVisible();

  await clickWorldPoint(750, 533.3333333333334);
  await page.getByRole("menuitemradio", { name: "Glatter Knoten" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Siedlung als JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const wall = exported.map.palisades.find(
    (palisade: { name: string }) => palisade.name === "Neue Steinmauer",
  );
  const heartPalisade = exported.map.palisades.find(
    (palisade: { name: string }) => palisade.name === "Herzdorfer Palisade",
  );
  expect(heartPalisade.segments).toHaveLength(6);
  expect(
    heartPalisade.segments.filter(
      (segment: { kind: string }) => segment.kind === "bezier",
    ),
  ).toHaveLength(6);
  expect(wall.segments).toHaveLength(2);
  expect(wall.segments.every((segment: { kind: string }) => segment.kind === "bezier"))
    .toBe(true);
  expect(wall.segments.map((segment: { fromMode: string; toMode: string }) => [
    segment.fromMode,
    segment.toMode,
  ]).flat()).toContain("smooth");
});
