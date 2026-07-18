import { useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaStatus = Readonly<{
  installAvailable: boolean;
  offlineReady: boolean;
  updateAvailable: boolean;
}>;

const initialStatus: PwaStatus = Object.freeze({
  installAvailable: false,
  offlineReady: false,
  updateAvailable: false,
});

let status = initialStatus;
let installPrompt: InstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let reloadForUpdate = false;
const trackedWorkers = new WeakSet<ServiceWorker>();
const listeners = new Set<() => void>();

function publish(changes: Partial<PwaStatus>): void {
  const next = Object.freeze({ ...status, ...changes });
  if (
    next.installAvailable === status.installAvailable
    && next.offlineReady === status.offlineReady
    && next.updateAvailable === status.updateAvailable
  ) return;
  status = next;
  for (const listener of listeners) listener();
}

export function subscribePwaStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaStatus(): PwaStatus {
  return status;
}

export function usePwaStatus(): PwaStatus {
  return useSyncExternalStore(subscribePwaStatus, getPwaStatus, getPwaStatus);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function trackInstallingWorker(
  worker: ServiceWorker | null,
  targetRegistration: ServiceWorkerRegistration,
): void {
  if (!worker || trackedWorkers.has(worker)) return;
  trackedWorkers.add(worker);
  const updateState = () => {
    if (worker.state !== "installed") return;
    if (navigator.serviceWorker.controller) {
      registration = targetRegistration;
      publish({ updateAvailable: true });
    } else {
      publish({ offlineReady: true });
    }
  };
  worker.addEventListener("statechange", updateState);
  updateState();
}

function bindRegistration(targetRegistration: ServiceWorkerRegistration): void {
  registration = targetRegistration;
  if (targetRegistration.waiting && navigator.serviceWorker.controller) {
    publish({ updateAvailable: true });
  }
  trackInstallingWorker(targetRegistration.installing, targetRegistration);
  targetRegistration.addEventListener("updatefound", () => {
    trackInstallingWorker(targetRegistration.installing, targetRegistration);
  });
}

export function registerPwa(): Promise<ServiceWorkerRegistration | null> {
  if (registrationPromise) return registrationPromise;
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
    registrationPromise = Promise.resolve(null);
    return registrationPromise;
  }

  window.addEventListener("beforeinstallprompt", ((event: InstallPromptEvent) => {
    event.preventDefault();
    installPrompt = event;
    publish({ installAvailable: !isStandalone() });
  }) as EventListener);
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    publish({ installAvailable: false });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadForUpdate) window.location.reload();
  });

  registrationPromise = navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    })
    .then((targetRegistration) => {
      bindRegistration(targetRegistration);
      const checkForUpdate = () => void targetRegistration.update().catch(() => undefined);
      window.addEventListener("focus", checkForUpdate);
      window.setInterval(checkForUpdate, 60 * 60 * 1_000);
      return targetRegistration;
    })
    .catch(() => null);
  return registrationPromise;
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | null> {
  const prompt = installPrompt;
  if (!prompt) return null;
  installPrompt = null;
  publish({ installAvailable: false });
  await prompt.prompt();
  return (await prompt.userChoice).outcome;
}

export async function activateWaitingWorker(
  worker: Pick<ServiceWorker, "postMessage"> | null,
  prepareForReload: () => boolean | Promise<boolean>,
  beforeActivation: () => void = () => undefined,
): Promise<boolean> {
  if (!worker || !await prepareForReload()) return false;
  beforeActivation();
  worker.postMessage({ type: "SKIP_WAITING" });
  return true;
}

export async function applyPwaUpdate(
  prepareForReload: () => boolean | Promise<boolean>,
): Promise<boolean> {
  const targetRegistration = registration ?? await registerPwa();
  return activateWaitingWorker(
    targetRegistration?.waiting ?? null,
    prepareForReload,
    () => {
      reloadForUpdate = true;
      publish({ updateAvailable: false });
    },
  );
}
