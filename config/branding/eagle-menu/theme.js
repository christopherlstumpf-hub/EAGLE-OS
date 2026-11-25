// EAGLE-OS colour scheme: the accent colour (orange by default) used across EAGLE pages,
// the Firefox toolbar and the E button. Colours taken from the Mountains screensaver pictures.
"use strict";
const EAGLE_THEMES = [
  { id: "orange",   name: "EAGLE Orange",   color: "#ff7a00", from: "The classic EAGLE-OS colour" },
  { id: "gold",     name: "Sunset Gold",    color: "#fcaf5a", from: "Sun on the horizon, mountain sunset" },
  { id: "ember",    name: "Sunset Ember",   color: "#e5874a", from: "Glowing sky, mountain sunset" },
  { id: "dawn",     name: "Dawn Glow",      color: "#e7b08f", from: "First light behind the peaks" },
  { id: "rose",     name: "Alpenglow",      color: "#c7707a", from: "Peaks at sunset" },
  { id: "sky",      name: "Alpine Sky",     color: "#90c0e6", from: "Clear sky over the lake" },
  { id: "lake",     name: "Mountain Lake",  color: "#4f85bd", from: "Blue sky reflected in the lake" },
  { id: "twilight", name: "Twilight Peaks", color: "#788fbd", from: "Blue peaks at dawn" },
  { id: "pine",     name: "Pine Forest",    color: "#6f9e8f", from: "Pines along the shore" },
];
const EAGLE_DEFAULT_ACCENT = "#ff7a00";

function eagleHex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }
function eagleShade(c, f) { // f > 0 lighter, f < 0 darker
  return "#" + eagleHex(c).map((v) => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)).toString(16).padStart(2, "0")).join("");
}

// Recolour the orange parts of an image (logo, E icon) to the accent colour.
function eagleTintPixels(d, accent) {   // d: ImageData, changed in place
  if (accent.toLowerCase() === EAGLE_DEFAULT_ACCENT) return d;
  const p = d.data;
  const [ar, ag, ab] = eagleHex(accent);
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 40 || (mx - mn) / mx < 0.45 || r !== mx || g < b) continue;   // only orange-ish pixels
    const hue = 60 * ((g - b) / (mx - mn));
    if (hue < 12 || hue > 50) continue;
    const k = mx / 255;                                                   // keep its brightness
    p[i] = Math.round(ar * k); p[i + 1] = Math.round(ag * k); p[i + 2] = Math.round(ab * k);
  }
  return d;
}
function eagleTint(img, accent) {        // pages: <img> -> canvas
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  if (accent.toLowerCase() === EAGLE_DEFAULT_ACCENT) return c;
  const d = ctx.getImageData(0, 0, c.width, c.height);
  ctx.putImageData(eagleTintPixels(d, accent), 0, 0);
  return c;
}

// In EAGLE pages: apply the accent to CSS and to images marked data-tint.
(function () {
  if (typeof document === "undefined" || !document.documentElement) return;
  const originals = new WeakMap();
  function apply(accent) {
    const root = document.documentElement.style;
    root.setProperty("--orange", accent);
    root.setProperty("--orange-hover", eagleShade(accent, 0.18));
    root.setProperty("--orange-soft", accent + "40");
    for (const img of document.querySelectorAll("img[data-tint]")) {
      const go = () => {
        if (!originals.has(img)) originals.set(img, img.src);
        if (accent.toLowerCase() === EAGLE_DEFAULT_ACCENT) { img.src = originals.get(img); return; }
        const src = new Image();
        src.onload = () => { img.src = eagleTint(src, accent).toDataURL(); };
        src.src = originals.get(img);
      };
      if (img.complete && img.naturalWidth) go(); else img.addEventListener("load", go, { once: true });
    }
  }
  if (typeof browser === "undefined" || !browser.storage) return;
  // "Back to the EAGLE tab": go to the pinned EAGLE tab and close this one (no second EAGLE tab)
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href="start.html"]');
    if (!a || location.pathname.endsWith("/start.html")) return;
    ev.preventDefault();
    browser.runtime.sendMessage({ type: "focus-start" }).catch(() => {}).finally(() => window.close());
  });
  browser.storage.local.get({ accent: EAGLE_DEFAULT_ACCENT }).then((s) => apply(s.accent)).catch(() => {});
  browser.storage.onChanged.addListener((ch) => { if (ch.accent) apply(ch.accent.newValue || EAGLE_DEFAULT_ACCENT); });
})();
