// EAGLE-OS toolbar menu.
browser.runtime.sendNativeMessage("eagle", { action: "status" }).then((s) => {
  if (s && s.live) document.getElementById("install").classList.remove("hidden");
}).catch(() => {});

for (const b of document.querySelectorAll("button[data-action]")) {
  b.addEventListener("click", async () => {
    const action = b.dataset.action;
    if (action === "camera") {
      await browser.tabs.create({ url: browser.runtime.getURL("camera.html") });
    } else {
      await browser.runtime.sendNativeMessage("eagle", { action }).catch(() => {});
    }
    window.close();
  });
}
