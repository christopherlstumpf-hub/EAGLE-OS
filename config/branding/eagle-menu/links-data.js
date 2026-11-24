// EAGLE-OS link tabs: the sites that open as tabs next to the EAGLE tab.
// Six fixed ones, then your own (E menu > Link tabs). Shared by the background and the Link tabs page.
"use strict";
const EAGLE_FIXED_LINKS = [
  { title: "Google", url: "https://www.google.com/" },
  { title: "Gmail", url: "https://mail.google.com/" },
  { title: "YouTube", url: "https://www.youtube.com/" },
  { title: "Maps", url: "https://maps.google.com/" },
  { title: "News", url: "https://news.google.com/" },
  { title: "Weather", url: "https://weather.com/" },
];
const EAGLE_STARTER_LINKS = [
  { title: "Spotify", url: "https://open.spotify.com/" },
  { title: "Facebook", url: "https://www.facebook.com/" },
];
const EAGLE_MAX_LINKS = 18;

// Your own links (older EAGLE versions also kept "action" buttons like Wi-Fi here: those are dropped)
async function eagleLoadLinks() {
  let mine;
  try {
    const s = await browser.storage.local.get({ links: null, linksVersion: 1 });
    mine = Array.isArray(s.links) ? s.links : EAGLE_STARTER_LINKS.slice();
    if (Array.isArray(s.links) && s.linksVersion < 3) {
      mine = mine.filter((l) => l && l.url && /^https?:/i.test(l.url));
      if (!mine.some((l) => /facebook\.com/i.test(l.url))) mine.push({ title: "Facebook", url: "https://www.facebook.com/" });
      await browser.storage.local.set({ links: mine, linksVersion: 3 });
    }
  } catch (e) { mine = EAGLE_STARTER_LINKS.slice(); }
  return mine.filter((l) => l && l.url && /^https?:/i.test(l.url));
}
async function eagleAllLinks() { return EAGLE_FIXED_LINKS.concat(await eagleLoadLinks()); }

function eagleNormaliseUrl(text) {
  let t = (text || "").trim();
  if (!t) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = "https://" + t;
  try {
    const u = new URL(t);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return null;
    return u.href;
  } catch (e) { return null; }
}
