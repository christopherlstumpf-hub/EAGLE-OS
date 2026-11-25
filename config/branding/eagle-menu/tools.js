// EAGLE-OS Tools page: tools that open an EAGLE screen ask the system through the native helper
"use strict";
document.querySelectorAll("[data-screen]").forEach((b) => {
  b.addEventListener("click", () => {
    browser.runtime.sendNativeMessage("eagle", { action: b.dataset.screen }).catch(() => {});
  });
});
