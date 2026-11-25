// EAGLE-OS (Chrome): runs inside the page so activity.js can see alert() from background tabs.
(() => {
  if (window.top !== window) return;
  const orig = window.alert;
  window.alert = function (t) {
    try { document.dispatchEvent(new CustomEvent("eagle-page-alert", { detail: String(t == null ? "" : t) })); } catch (e) { /* ignore */ }
    return orig.apply(this, arguments);
  };
})();
