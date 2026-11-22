// EAGLE start page: show the Install button when running from the USB stick / card,
// and make the page's EAGLE buttons work.
(async () => {
  let status = {};
  try { status = await browser.runtime.sendMessage({ action: "status" }); } catch (e) { return; }
  document.documentElement.dataset.eagle = "ready";
  if (status.live) document.documentElement.dataset.live = "yes";
  for (const el of document.querySelectorAll("[data-eagle-action]")) {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      browser.runtime.sendMessage({ action: el.dataset.eagleAction });
    });
  }
})();
