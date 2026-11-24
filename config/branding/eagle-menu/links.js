// EAGLE-OS Link tabs page: add and remove the sites that open as tabs next to the EAGLE tab.
"use strict";
const $ = (id) => document.getElementById(id);
let mine = [];
function row(l, fixed, index) {
  const r = document.createElement("div"); r.className = "link";
  const ic = document.createElement("span"); ic.className = "ic"; ic.textContent = l.title.charAt(0).toUpperCase();
  const tx = document.createElement("div"); tx.className = "tx";
  const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = l.title;
  const ad = document.createElement("div"); ad.className = "ad"; ad.textContent = l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  tx.append(nm, ad);
  r.append(ic, tx);
  if (fixed) {
    const k = document.createElement("span"); k.className = "lock"; k.textContent = "Always";
    r.appendChild(k);
  } else {
    const b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.textContent = "Remove";
    b.addEventListener("click", async () => {
      mine.splice(index, 1);
      await browser.storage.local.set({ links: mine });
      render();
    });
    r.appendChild(b);
  }
  return r;
}
async function render() {
  mine = await eagleLoadLinks();
  const all = EAGLE_FIXED_LINKS.map((l) => ({ l, fixed: true }))
    .concat(mine.map((l, i) => ({ l, fixed: false, i })))
    .sort((a, b) => a.l.title.localeCompare(b.l.title, undefined, { sensitivity: "base" }));
  const box = $("list");
  box.textContent = "";
  for (const x of all) box.appendChild(row(x.l, x.fixed, x.i));
  $("add-btn").disabled = mine.length >= EAGLE_MAX_LINKS;
}
function say(t, cls) { $("msg").textContent = t; $("msg").className = cls || ""; }
$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("name").value.trim().slice(0, 24);
  const url = eagleNormaliseUrl($("url").value);
  if (!name) { say("Give the tab a name.", "bad"); return; }
  if (!url) { say("That web address doesn't look right. Try something like facebook.com", "bad"); return; }
  mine = await eagleLoadLinks();
  if (mine.length >= EAGLE_MAX_LINKS) { say("Up to " + EAGLE_MAX_LINKS + " of your own tabs.", "bad"); return; }
  if (EAGLE_FIXED_LINKS.concat(mine).some((l) => l.url === url)) { say("That site already has a tab.", "bad"); return; }
  mine.push({ title: name, url });
  await browser.storage.local.set({ links: mine });
  $("name").value = ""; $("url").value = "";
  say(name + " added. Its tab is next to the EAGLE tab.", "good");
  render();
});
browser.storage.onChanged.addListener((ch) => { if (ch.links) render(); });
render();
