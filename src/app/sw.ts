// HalePulse service worker (Phase 1 of offline POS).
//
// Precaches the built app shell — HTML, JS, CSS, fonts, icons — so the app
// opens with its full UI and animations even with no network, once it has been
// visited online at least once. Runtime caching (navigations, assets) uses
// Serwist's sensible defaults. Later phases add the local catalogue + sale
// outbox on top of this foundation.
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next — the list of assets to precache.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
