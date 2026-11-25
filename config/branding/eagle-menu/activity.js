// EAGLE-OS: tell the EAGLE add-on that someone is using the PC (for the screen timeout and
// screensaver). Runs in every page and frame; sends at most one message every 5 seconds.
(() => {
  let last = 0;
  const ping = () => {
    const now = Date.now();
    if (now - last < 5000) return;
    last = now;
    try { browser.runtime.sendMessage({ type: "activity" }).catch(() => {}); } catch (e) { /* page unloading */ }
  };
  for (const ev of ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"]) {
    window.addEventListener(ev, ping, { passive: true, capture: true });
  }

  // alert() from a tab you're not looking at: tell the EAGLE add-on so it lands in the
  // Notifications panel. The box itself waits inside that tab until you open it.
  const noteAlert = (text) => {
    if (window.top !== window) return;
    try { browser.runtime.sendMessage({ type: "page-alert", text: String(text == null ? "" : text) }).catch(() => {}); } catch (e) { /* ignore */ }
  };
  if (typeof exportFunction === "function" && window.wrappedJSObject) {
    // Firefox: wrap the page's alert() directly
    try {
      const page = window.wrappedJSObject, orig = page.alert;
      exportFunction(function (t) { noteAlert(t); return orig.call(page, t); }, page, { defineAs: "alert" });
    } catch (e) { /* ignore */ }
  } else {
    // Chrome: alert-hook.js runs in the page and sends an event here
    document.addEventListener("eagle-page-alert", (ev) => noteAlert(ev.detail), true);
  }

  // Low battery warning from the EAGLE add-on: a notice in the corner of the page
  if (window.top !== window) return;
  browser.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "battery-warn" || !document.documentElement) return undefined;
    const old = document.getElementById("eagle-battery-warn");
    if (old) old.remove();
    const host = document.createElement("div");
    host.id = "eagle-battery-warn";
    host.style.cssText = "all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    const box = document.createElement("div");
    box.style.cssText = "font:15px 'Noto Sans','DejaVu Sans',sans-serif;color:#fff;background:#151515;max-width:360px;" +
      "padding:14px 18px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.6);cursor:pointer;border:3px solid " +
      (msg.critical ? "#e0483e" : (msg.accent || "#ff7a00"));
    const title = document.createElement("div");
    title.textContent = "Low battery";
    title.style.cssText = "font-weight:800;margin-bottom:4px;color:" + (msg.critical ? "#ff6b61" : (msg.accent || "#ff7a00"));
    const text = document.createElement("div");
    text.textContent = msg.text;
    box.append(title, text);
    root.appendChild(box);
    box.addEventListener("click", () => host.remove());
    document.documentElement.appendChild(host);
    if (!msg.critical) setTimeout(() => host.remove(), 20000);
    return undefined;
  });
})();
