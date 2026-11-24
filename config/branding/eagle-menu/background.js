// EAGLE-OS add-on background: screen timeout and screensaver.
//  - "Return to start page": after N minutes with no activity, close the other tabs and show the
//    EAGLE start page.
//  - Screensaver: after N minutes with no activity, show a full-screen slideshow; any input returns.
// A tab playing sound (video, music) counts as activity.

const DEFAULTS = { timeoutMin: 0, saverMin: 10, saverTheme: "season" };
const START = browser.runtime.getURL("start.html");
const SAVER = browser.runtime.getURL("screensaver.html");

let settings = { ...DEFAULTS };
let lastActivity = Date.now();
let resetDone = false;
let saver = null;               // { tabId, prevTabId, windowId, prevState }
let suppressUntil = 0;          // ignore tab events caused by our own changes

async function loadSettings() {
  try { settings = { ...DEFAULTS, ...(await browser.storage.local.get(DEFAULTS)) }; } catch (e) { settings = { ...DEFAULTS }; }
}
loadSettings();
browser.storage.onChanged.addListener((changes) => {
  if (Object.keys(changes).some((k) => k in DEFAULTS)) { loadSettings(); activity(); }
  if (changes.calendars) syncCalendars();
});

function activity() { lastActivity = Date.now(); resetDone = false; }
function suppress() { suppressUntil = Date.now() + 2500; }
function ours() { return Date.now() < suppressUntil; }

browser.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !msg.type) return undefined;
  switch (msg.type) {
    case "activity":
      if (saver && sender.tab && sender.tab.id === saver.tabId) return undefined;
      activity();
      return undefined;
    case "saver-dismiss":
      activity();
      return closeSaver();
    case "saver-preview":
      return openSaver(true);
    case "cal-refresh":
      return syncCalendars();
    case "get-battery":
      return Promise.resolve(lastBattery);
    case "get-settings":
      return Promise.resolve(settings);
    case "get-state":
      return Promise.resolve({ idleSeconds: Math.round((Date.now() - lastActivity) / 1000), saver: !!saver, settings });
    default:
      return undefined;
  }
});

browser.tabs.onActivated.addListener((info) => { if (!ours() && !(saver && info.tabId === saver.tabId)) activity(); });
browser.tabs.onCreated.addListener((tab) => { if (!ours() && !(saver && tab.id === saver.tabId)) activity(); });
browser.tabs.onRemoved.addListener((tabId) => {
  if (saver && tabId === saver.tabId) { const s = saver; saver = null; restoreWindow(s); activity(); }
});

async function restoreWindow(s) {
  try { await browser.windows.update(s.windowId, { state: s.prevState === "fullscreen" ? "fullscreen" : "maximized" }); } catch (e) { /* closed */ }
}

async function openSaver(preview) {
  if (saver) return;
  suppress();
  let win, active;
  try { win = await browser.windows.getLastFocused(); } catch (e) { return; }
  [active] = await browser.tabs.query({ active: true, windowId: win.id });
  const tab = await browser.tabs.create({ url: SAVER + (preview ? "#preview" : ""), active: true, windowId: win.id });
  saver = { tabId: tab.id, prevTabId: active ? active.id : null, windowId: win.id, prevState: win.state };
  try { await browser.windows.update(win.id, { state: "fullscreen" }); } catch (e) { /* not supported */ }
}

async function closeSaver() {
  if (!saver) return;
  const s = saver;
  saver = null;
  suppress();
  await restoreWindow(s);
  if (s.prevTabId) { try { await browser.tabs.update(s.prevTabId, { active: true }); } catch (e) { /* gone */ } }
  try { await browser.tabs.remove(s.tabId); } catch (e) { /* gone */ }
}

async function resetToStart() {
  suppress();
  const tabs = await browser.tabs.query({});
  const keep = saver ? saver.tabId : null;
  const startTab = await browser.tabs.create({ url: START, active: !saver });
  const close = tabs.filter((t) => t.id !== keep && t.id !== startTab.id).map((t) => t.id);
  if (close.length) { try { await browser.tabs.remove(close); } catch (e) { /* some gone */ } }
  if (saver) saver.prevTabId = startTab.id;
}

async function tick() {
  try {
    const playing = await browser.tabs.query({ audible: true });
    if (playing.some((t) => !(saver && t.id === saver.tabId))) activity();
  } catch (e) { /* ignore */ }
  const idleMin = (Date.now() - lastActivity) / 60000;
  if (settings.timeoutMin > 0 && idleMin >= settings.timeoutMin && !resetDone) {
    resetDone = true;
    await resetToStart();
  }
  if (settings.saverMin > 0 && idleMin >= settings.saverMin && !saver) {
    await openSaver(false);
  }
}
setInterval(tick, 5000);

// ---------- Calendar links (Google, Outlook, iCloud, Yahoo ... iCal links) ----------
// The links stay on this PC (storage.local "calendars"). Events from 6 weeks back to 13 months
// ahead are kept in storage.local "calData" for the start page. Refreshed every 15 minutes.
let syncing = null;
async function fetchCalendar(c, from, to) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(EagleICal.normalizeUrl(c.url), { cache: "no-store", credentials: "omit", signal: ctl.signal });
    if (!r.ok) throw new Error(r.status === 404 || r.status === 403 || r.status === 401
      ? "The calendar link was refused. It may have been reset; copy a new link." : "The calendar site answered " + r.status + ".");
    const text = await r.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That link isn't an iCal calendar link.");
    return EagleICal.parse(text, from, to).slice(0, 4000);
  } finally { clearTimeout(timer); }
}
function syncCalendars() {
  if (syncing) return syncing;
  syncing = (async () => {
    let cals = [];
    try { cals = (await browser.storage.local.get({ calendars: [] })).calendars || []; } catch (e) { /* none */ }
    const prev = (await browser.storage.local.get({ calData: { events: [], status: {} } })).calData;
    const from = Date.now() - 42 * 86400000, to = Date.now() + 400 * 86400000;
    const events = [], status = {};
    for (const c of cals) {
      try {
        const list = await fetchCalendar(c, from, to);
        for (const e of list) events.push({ ...e, cal: c.id });
        status[c.id] = { ok: true, when: Date.now(), count: list.length };
      } catch (err) {
        // offline or failed: keep this calendar's last good events
        for (const e of prev.events || []) if (e.cal === c.id) events.push(e);
        const old = (prev.status || {})[c.id] || {};
        status[c.id] = { ok: false, when: old.when || 0, count: old.count || 0,
          error: err.name === "AbortError" || err instanceof TypeError ? "Couldn't reach the calendar. Is the PC online?" : err.message };
      }
    }
    events.sort((a, b) => a.start - b.start);
    await browser.storage.local.set({ calData: { events, status, updated: Date.now() } });
  })().finally(() => { syncing = null; });
  return syncing;
}
syncCalendars();
setInterval(syncCalendars, 15 * 60000);

// ---------- Battery: level on the E button, warnings when low ----------
let lastBattery = null;
const warned = new Set();
function batteryText(b) {
  if (!b || !b.present || b.percent == null) return "";
  const h = b.minutes != null ? (b.minutes >= 60 ? Math.floor(b.minutes / 60) + " h " + (b.minutes % 60) + " min" : b.minutes + " min") : "";
  if (b.charging) return "Battery " + b.percent + "%, charging" + (h ? " (full in " + h + ")" : "");
  if (b.plugged) return "Battery " + b.percent + "%, plugged in";
  return "Battery " + b.percent + "%" + (h ? ", about " + h + " left" : "");
}
async function checkBattery() {
  let b = null;
  try { b = await browser.runtime.sendNativeMessage("eagle", { action: "battery" }); } catch (e) { return; }
  lastBattery = b;
  const ba = browser.browserAction;
  if (!b || !b.present || b.percent == null) {
    ba.setBadgeText({ text: "" }); ba.setTitle({ title: "EAGLE-OS menu" }); return;
  }
  const low = !b.plugged && !b.charging && b.percent <= 20;
  const text = b.charging ? "⚡" + b.percent : (b.plugged ? "⚡" : b.percent + "%");
  ba.setBadgeText({ text });
  ba.setBadgeBackgroundColor({ color: low ? "#e0483e" : (b.charging || b.plugged ? "#2e7d32" : "#3a3a3a") });
  if (ba.setBadgeTextColor) ba.setBadgeTextColor({ color: "#ffffff" });
  ba.setTitle({ title: "EAGLE-OS menu · " + batteryText(b) });
  browser.runtime.sendMessage({ type: "battery", battery: b }).catch(() => {});

  // low battery warnings at 20%, 10% and 5% (once each per discharge)
  if (b.plugged || b.charging) { warned.clear(); return; }
  for (const level of [5, 10, 20]) {
    if (b.percent <= level && !warned.has(level)) {
      [5, 10, 20].filter((x) => x >= level).forEach((x) => warned.add(x));
      const msg = level === 5
        ? "Battery at " + b.percent + "%. Plug in now: EAGLE-OS will shut down at 3% to protect your files."
        : "Battery at " + b.percent + "%. Plug in the charger soon.";
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      const warn = { type: "battery-warn", text: msg, critical: level === 5, accent: currentAccent };
      if (tab) browser.tabs.sendMessage(tab.id, warn).catch(() => {});
      browser.runtime.sendMessage(warn).catch(() => {});   // EAGLE pages (start page, settings)
      break;
    }
  }
}
checkBattery();
setInterval(checkBattery, 60000);

// ---------- Colour scheme: Firefox toolbar colours and the E button follow the chosen accent ----------
const BASE_THEME = {
  "frame": "#0b0b0b",
  "frame_inactive": "#0b0b0b",
  "tab_background_text": "#b8b8b8",
  "tab_selected": "#2a2a2a",
  "tab_text": "#ffffff",
  "tab_line": "#ff7a00",
  "tab_loading": "#ff7a00",
  "toolbar": "#2a2a2a",
  "toolbar_text": "#e6e6e6",
  "toolbar_field": "#141414",
  "toolbar_field_text": "#f0f0f0",
  "toolbar_field_border": "#3c3c3c",
  "toolbar_field_focus": "#141414",
  "toolbar_field_text_focus": "#ffffff",
  "toolbar_field_border_focus": "#ff7a00",
  "toolbar_field_highlight": "#ff7a00",
  "toolbar_field_highlight_text": "#000000",
  "toolbar_top_separator": "#2a2a2a",
  "toolbar_bottom_separator": "#000000",
  "icons": "#d6d6d6",
  "icons_attention": "#ff7a00",
  "button_background_hover": "#3a3a3a",
  "button_background_active": "#4a4a4a",
  "popup": "#1e1e1e",
  "popup_text": "#e6e6e6",
  "popup_border": "#3c3c3c",
  "popup_highlight": "#ff7a00",
  "popup_highlight_text": "#000000",
  "ntp_background": "#0b0b0b",
  "ntp_text": "#e6e6e6",
  "sidebar": "#1e1e1e",
  "sidebar_text": "#e6e6e6",
  "sidebar_border": "#3c3c3c"
};
let currentAccent = EAGLE_DEFAULT_ACCENT;
async function applyAccent(accent) {
  currentAccent = accent || EAGLE_DEFAULT_ACCENT;
  if (currentAccent.toLowerCase() === EAGLE_DEFAULT_ACCENT) {
    try { await browser.theme.reset(); } catch (e) { /* ignore */ }
  } else {
    const colors = {};
    for (const [k, v] of Object.entries(BASE_THEME)) colors[k] = v.toLowerCase() === "#ff7a00" ? currentAccent : v;
    try { await browser.theme.update({ colors }); } catch (e) { /* ignore */ }
  }
  // E button icon
  try {
    const imageData = {};
    for (const size of [64, 128]) {
      const img = new Image();
      img.src = browser.runtime.getURL(`icon-${size}.png`);
      await img.decode();
      const c = eagleTint(img, currentAccent);
      imageData[size] = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    }
    await browser.browserAction.setIcon({ imageData });
  } catch (e) { /* keep the packaged icon */ }
}
browser.storage.local.get({ accent: EAGLE_DEFAULT_ACCENT }).then((s) => applyAccent(s.accent));
browser.storage.onChanged.addListener((ch) => { if (ch.accent) applyAccent(ch.accent.newValue); });

// ---------- Startup guard: Firefox always opens on the EAGLE start page ----------
// On some PCs Firefox can show a welcome/privacy page, a blank tab or an error before the
// EAGLE add-on is ready. For the first 30 seconds, swap any such tab for the start page.
const START_URL = browser.runtime.getURL("start.html");
const NOT_EAGLE = /^(about:(blank|home|newtab|welcome|privatebrowsing|sessionrestore|tabcrashed|neterror|certerror)|moz-extension:\/\/[^/]+\/?$)|^https?:\/\/(www\.)?mozilla\.org\/.*(privacy|firstrun|whatsnew|welcome)|^https?:\/\/(www\.)?firefox\.com\//i;
const FIRST_RUN_PAGE = /^about:(welcome|sessionrestore)|^https?:\/\/(www\.)?mozilla\.org\/|^https?:\/\/(www\.)?firefox\.com\//i;
const guardUntil = Date.now() + 30000;
let guardRuns = 0;
async function startupGuard() {
  if (Date.now() > guardUntil) return;
  let tabs = [];
  try { tabs = await browser.tabs.query({}); } catch (e) { return; }
  if (!tabs.length) return;
  // The start page may have tried to load before the add-on was ready: load it again once.
  if (guardRuns++ === 0) {
    for (const t of tabs) if ((t.url || "").startsWith(START_URL)) browser.tabs.reload(t.id).catch(() => {});
  }
  const hasStart = tabs.some((t) => (t.url || "").startsWith(START_URL));
  if (!hasStart) {
    const early = Date.now() < guardUntil - 27000;   // only in the first 3 seconds: any lone page
    const first = tabs.find((t) => NOT_EAGLE.test(t.url || "about:blank")) || (early && tabs.length === 1 ? tabs[0] : null);
    if (first) await browser.tabs.update(first.id, { url: START_URL, active: true }).catch(() => {});
  }
  // Close Mozilla welcome / privacy / what's-new tabs
  const extra = tabs.filter((t) => FIRST_RUN_PAGE.test(t.url || ""));
  if (extra.length && extra.length < tabs.length) await browser.tabs.remove(extra.map((t) => t.id)).catch(() => {});
}
for (const ms of [500, 2000, 5000, 10000, 20000]) setTimeout(startupGuard, ms);
browser.tabs.onCreated.addListener(() => { if (Date.now() < guardUntil) setTimeout(startupGuard, 800); });
browser.tabs.onUpdated.addListener((id, info) => { if (info.url && Date.now() < guardUntil) setTimeout(startupGuard, 300); });
