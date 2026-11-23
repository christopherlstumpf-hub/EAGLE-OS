// EAGLE start page (inside the EAGLE-OS add-on, so it can reach the EAGLE helper):
// shows the Install banner when running from the USB stick / card and wires the EAGLE buttons.
(async () => {
  let status = {};
  try { status = await browser.runtime.sendNativeMessage("eagle", { action: "status" }); } catch (e) { status = {}; }
  document.documentElement.dataset.eagle = "ready";
  if (status && status.live) document.documentElement.dataset.live = "yes";
  for (const el of document.querySelectorAll("[data-eagle-action]")) {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      browser.runtime.sendNativeMessage("eagle", { action: el.dataset.eagleAction }).catch(() => {});
    });
  }
})();

// Clock
  function tick() {
    var d = new Date();
    document.getElementById("clock").textContent =
      d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" }) + "  ·  " +
      d.toLocaleTimeString(undefined, { hour:"numeric", minute:"2-digit" });
  }
  tick(); setInterval(tick, 15000);
