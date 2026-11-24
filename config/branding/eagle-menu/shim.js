// The EAGLE add-on runs in Firefox and in Google Chrome: in Chrome, use the "chrome" API
// under Firefox's "browser" name (Chrome's Manifest V3 API returns promises too).
"use strict";
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}
globalThis.EAGLE_IS_CHROME = !(globalThis.browser && browser.runtime && typeof browser.runtime.getBrowserInfo === "function");
