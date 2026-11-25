// EAGLE-OS link tab: a tiny stand-in page that shows the site's name and a letter icon in the tab,
// and only loads the real site when you click the tab (saves memory on small PCs).
"use strict";
const q = new URLSearchParams(location.search);
const url = q.get("u") || "";
const name = q.get("t") || "Site";
const color = q.get("c") || "#ff7a00";
document.title = name;
document.getElementById("msg").textContent = "Opening " + name + "…";

// letter icon for the tab
try {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = color;
  x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#000";
  x.font = "bold 38px 'Noto Sans', 'DejaVu Sans', sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(name.trim().charAt(0).toUpperCase() || "•", 32, 35);
  const link = document.createElement("link");
  link.rel = "icon"; link.href = c.toDataURL();
  document.head.appendChild(link);
} catch (e) { /* no icon */ }

// the tabs are pinned (icon only), so show the site's own icon as soon as it can be fetched
try {
  const host = new URL(url).hostname;
  const src = "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(host);
  const img = new Image();
  img.onload = () => {
    if (img.naturalWidth < 2) return;
    for (const l of document.querySelectorAll("link[rel=icon]")) l.remove();
    const link = document.createElement("link");
    link.rel = "icon"; link.href = src;
    document.head.appendChild(link);
  };
  img.src = src;
} catch (e) { /* keep the letter */ }

function go() {
  if (document.visibilityState === "visible" && /^https?:\/\//i.test(url)) location.replace(url);
}
document.addEventListener("visibilitychange", go);
go();
