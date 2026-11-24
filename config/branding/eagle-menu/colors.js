// EAGLE-OS colour scheme page
"use strict";
["m1", "m2", "m3"].forEach((id, i) => {
  document.getElementById(id).style.backgroundImage = `url("scenes/mountains-${i + 1}.jpg")`;
});
const box = document.getElementById("swatches");
function build(current) {
  box.textContent = "";
  for (const t of EAGLE_THEMES) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio"; input.name = "accent"; input.value = t.color;
    input.checked = t.color.toLowerCase() === current.toLowerCase();
    const sw = document.createElement("div"); sw.className = "sw";
    const dot = document.createElement("span"); dot.className = "dot"; dot.style.background = t.color; dot.textContent = "E";
    const txt = document.createElement("div");
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = t.name;
    if (t.id === "orange") { const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = "Original"; nm.appendChild(tag); }
    const fr = document.createElement("div"); fr.className = "fr"; fr.textContent = t.from;
    txt.append(nm, fr);
    sw.append(dot, txt);
    label.append(input, sw);
    input.addEventListener("change", async () => {
      await browser.storage.local.set({ accent: t.color });
      const s = document.getElementById("saved"); s.classList.add("show"); setTimeout(() => s.classList.remove("show"), 1500);
    });
    box.appendChild(label);
  }
}
browser.storage.local.get({ accent: EAGLE_DEFAULT_ACCENT }).then((s) => build(s.accent));
