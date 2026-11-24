// EAGLE-OS toolbar menu.
browser.runtime.sendNativeMessage("eagle", { action: "status" }).then((s) => {
  if (s && s.live) document.getElementById("install").classList.remove("hidden");
}).catch(() => {});

browser.runtime.sendNativeMessage("eagle", { action: "status" }).then((st) => {
  if (!st || !st.version) return;
  const v = document.createElement("small");
  v.textContent = (st.variant === "lite" ? "Lite · " : "") + st.version.replace(/^build\s*/i, "Build ");
  document.querySelector("header").appendChild(v);
}).catch(() => {});

browser.runtime.sendMessage({ type: "get-battery" }).then((b) => {
  if (!b || !b.present || b.percent == null) return;
  const el = document.getElementById("batt");
  const h = b.minutes != null ? (b.minutes >= 60 ? Math.floor(b.minutes / 60) + " h " + (b.minutes % 60) + " min" : b.minutes + " min") : "";
  el.textContent = b.charging ? "⚡ Battery " + b.percent + "% · charging" + (h ? " · full in " + h : "")
    : b.plugged ? "⚡ Battery " + b.percent + "% · plugged in"
    : "Battery " + b.percent + "% · on battery" + (h ? " · about " + h + " left" : "");
  if (!b.plugged && !b.charging && b.percent <= 20) el.classList.add("low");
  el.classList.remove("hidden");
}).catch(() => {});

for (const b of document.querySelectorAll("button[data-action]")) {
  b.addEventListener("click", async () => {
    const action = b.dataset.action;
    if (action === "camera") {
      await browser.tabs.create({ url: browser.runtime.getURL("camera.html") });
    } else if (action === "colors") {
      await browser.tabs.create({ url: browser.runtime.getURL("colors.html") });
    } else if (action === "screensaver") {
      await browser.tabs.create({ url: browser.runtime.getURL("settings.html") });
    } else {
      await browser.runtime.sendNativeMessage("eagle", { action }).catch(() => {});
    }
    window.close();
  });
}
