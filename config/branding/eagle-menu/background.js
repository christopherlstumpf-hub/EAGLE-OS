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
setInterval(tick, 15000);

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
      const warn = { type: "battery-warn", text: msg, critical: level === 5 };
      if (tab) browser.tabs.sendMessage(tab.id, warn).catch(() => {});
      browser.runtime.sendMessage(warn).catch(() => {});   // EAGLE pages (start page, settings)
      break;
    }
  }
}
checkBattery();
setInterval(checkBattery, 60000);
