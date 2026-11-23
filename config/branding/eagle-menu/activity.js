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
})();
