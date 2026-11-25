// EAGLE-OS (Chrome): runs inside calendar.google.com so gcal.js can see what Google's copy
// button puts on the clipboard (the calendar's secret address). Nothing else is looked at.
(() => {
  if (window.top !== window || !navigator.clipboard) return;
  const clip = navigator.clipboard, orig = clip.writeText;
  clip.writeText = function (t) {
    try { document.dispatchEvent(new CustomEvent("eagle-clip", { detail: String(t) })); } catch (e) { /* ignore */ }
    return orig.apply(clip, arguments);
  };
})();
