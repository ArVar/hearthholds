import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

const runtimeEnvironment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;
const deploymentBase = normalizeBasePath(runtimeEnvironment?.HEARTHHOLDS_BASE_PATH);

const pwaIconNames = {
  "192": "hearthholds-icon-192.png",
  "512": "hearthholds-icon-512.png",
} as const;

function createManifest(iconUrls: Record<keyof typeof pwaIconNames, string>) {
  return {
    id: "./",
    name: "Hearthholds: Living Places",
    short_name: "Hearthholds",
    description: "Local-first settlement map editor for tabletop role-playing games",
    lang: "en",
    start_url: "./",
    scope: "./",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#1a1d1d",
    theme_color: "#1a1d1d",
    categories: ["games", "productivity", "utilities"],
    icons: [
      { src: iconUrls["192"], sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrls["512"], sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

function createServiceWorker(fileNames: string[], versionSeed: string): string {
  const fingerprint = `${versionSeed}|${fileNames.join("|")}`.split("").reduce(
    (hash, character) => (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0,
    2166136261,
  ).toString(36);
  return `const CACHE_NAME = "hearthholds-precache-${fingerprint}";
const PRECACHE_PATHS = ${JSON.stringify([
    "./",
    "./index.html",
    "./manifest.webmanifest",
    ...fileNames.map((fileName) => `./${fileName}`),
  ])};
const scopedUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_PATHS.map(scopedUrl)),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name.startsWith("hearthholds-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === "navigate") {
        const shell = await caches.match(scopedUrl("./index.html"), { ignoreVary: true })
          ?? await caches.match(scopedUrl("./"), { ignoreVary: true });
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
`;
}

function hearthholdsPwa(): Plugin {
  return {
    name: "hearthholds-pwa",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if ((request as { url?: string }).url !== "/manifest.webmanifest") return next();
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/manifest+json");
        response.end(JSON.stringify(createManifest({
          "192": `/assets/branding/${pwaIconNames["192"]}`,
          "512": `/assets/branding/${pwaIconNames["512"]}`,
        })));
      });
    },
    generateBundle(_options, bundle) {
      const outputs = Object.values(bundle);
      const resolveIcon = (name: string) => {
        const output = outputs.find(({ fileName }) => fileName.includes(name.replace(".png", "-")));
        if (!output) throw new Error(`PWA icon was not emitted: ${name}`);
        return `./${output.fileName}`;
      };
      const manifest = createManifest({
        "192": resolveIcon(pwaIconNames["192"]),
        "512": resolveIcon(pwaIconNames["512"]),
      });
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });

      const fileNames = outputs
        .map(({ fileName }) => fileName)
        .filter((fileName) => fileName !== "index.html" && !fileName.endsWith(".map"))
        .sort();
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: createServiceWorker(fileNames, JSON.stringify(manifest)),
      });
    },
  };
}

export default defineConfig({
  base: deploymentBase,
  plugins: [react(), hearthholdsPwa()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
