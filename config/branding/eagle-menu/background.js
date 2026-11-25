// EAGLE-OS add-on background: screen timeout and screensaver.
//  - "Return to start page": after N minutes with no activity, close the other tabs and show the
//    EAGLE start page.
//  - Screensaver: after N minutes with no activity, show a full-screen slideshow; any input returns.
// A tab playing sound (video, music) counts as activity.

const DEFAULTS = { timeoutMin: 0, saverMin: 10, saverTheme: "season" };
const START = browser.runtime.getURL("start.html");
const SAVER = browser.runtime.getURL("screensaver.html");

const ACTION = browser.action || browser.browserAction;   // Chrome / Firefox toolbar button

// Repeating jobs. Firefox keeps this page running; Chrome stops its service worker when idle,
// so there alarms (every 30 s or more) wake it up and the state below is kept in storage.session.
const alarmJobs = {};
function every(name, ms, fn) {
  setInterval(fn, ms);
  if (EAGLE_IS_CHROME && browser.alarms) {
    alarmJobs[name] = fn;
    browser.alarms.create(name, { periodInMinutes: Math.max(0.5, ms / 60000) });
  }
}
if (EAGLE_IS_CHROME && browser.alarms) {
  browser.alarms.onAlarm.addListener((a) => { if (alarmJobs[a.name]) alarmJobs[a.name](); });
}

let settings = { ...DEFAULTS };
let lastActivity = Date.now();
let resetDone = false;
let saver = null;               // { tabId, prevTabId, windowId, prevState }
let suppressUntil = 0;          // ignore tab events caused by our own changes
let lastSaved = 0;
async function saveState(force) {
  if (!EAGLE_IS_CHROME || !browser.storage.session) return;
  if (!force && Date.now() - lastSaved < 15000) return;
  lastSaved = Date.now();
  try { await browser.storage.session.set({ bg: { lastActivity, resetDone, saver } }); } catch (e) { /* ignore */ }
}
const stateReady = (async () => {
  if (!EAGLE_IS_CHROME || !browser.storage.session) return;
  try {
    const b = (await browser.storage.session.get("bg")).bg;
    if (b) { lastActivity = b.lastActivity; resetDone = b.resetDone; saver = b.saver; }
  } catch (e) { /* ignore */ }
})();

async function loadSettings() {
  try { settings = { ...DEFAULTS, ...(await browser.storage.local.get(DEFAULTS)) }; } catch (e) { settings = { ...DEFAULTS }; }
}
const settingsReady = loadSettings();
browser.storage.onChanged.addListener((changes) => {
  shareSettings(changes);
  if (Object.keys(changes).some((k) => k in DEFAULTS)) { loadSettings(); activity(); }
  if (changes.calendars) syncCalendars(true);
});

function activity() { lastActivity = Date.now(); resetDone = false; saveState(); }
function suppress() { suppressUntil = Date.now() + 2500; }
function ours() { return Date.now() < suppressUntil; }

// Works in Firefox and Chrome: answers through sendResponse
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const r = handleMessage(msg, sender);
  if (r && typeof r.then === "function") {
    r.then((v) => sendResponse(v), () => sendResponse(undefined));
    return true;
  }
  return false;
});
function handleMessage(msg, sender) {
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
      return syncCalendars(true);
    case "get-battery":
      return Promise.resolve(lastBattery);
    case "focus-start":
      return focusStart();
    case "open-notice":
      return openNotice(msg.action || {});
    case "web-dismissed":
      for (const id of msg.ids || []) {
        const m = /^dn:(\d+)$/.exec(id);
        if (m) browser.runtime.sendNativeMessage("eagle", { action: "notify_dismiss", id: +m[1] }).catch(() => {});
      }
      return Promise.resolve(true);
    case "page-alert":
      return pageAlert(msg, sender);
    case "get-settings":
      return settingsReady.then(() => settings);
    case "get-state":
      return settingsReady.then(() => ({ idleSeconds: Math.round((Date.now() - lastActivity) / 1000), saver: !!saver, settings }));
    default:
      return undefined;
  }
}

browser.tabs.onActivated.addListener((info) => { if (!ours() && !(saver && info.tabId === saver.tabId)) activity(); });
browser.tabs.onCreated.addListener((tab) => { if (!ours() && !(saver && tab.id === saver.tabId)) activity(); });
browser.tabs.onRemoved.addListener((tabId) => {
  if (saver && tabId === saver.tabId) { const s = saver; saver = null; restoreWindow(s); activity(); saveState(true); }
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
  saveState(true);
  try { await browser.windows.update(win.id, { state: "fullscreen" }); } catch (e) { /* not supported */ }
}

async function closeSaver() {
  if (!saver) return;
  const s = saver;
  saver = null;
  saveState(true);
  suppress();
  await restoreWindow(s);
  if (s.prevTabId) { try { await browser.tabs.update(s.prevTabId, { active: true }); } catch (e) { /* gone */ } }
  try { await browser.tabs.remove(s.tabId); } catch (e) { /* gone */ }
}

async function resetToStart() {
  suppress();
  await tabsReady;
  const tabs = await browser.tabs.query({});
  const keep = new Set([saver ? saver.tabId : null, startTabId, ...Object.values(linkTabs)]);
  const close = tabs.filter((t) => !keep.has(t.id)).map((t) => t.id);
  if (close.length) { try { await browser.tabs.remove(close); } catch (e) { /* some gone */ } }
  // link tabs back to their (unloaded) starting point
  const links = await eagleAllLinks();
  for (const l of links) {
    const id = linkTabs[l.url];
    if (id == null) continue;
    try {
      const t = await browser.tabs.get(id);
      if (!(t.url || "").startsWith(LINKTAB)) await browser.tabs.update(id, { url: linkTabUrl(l) });
    } catch (e) { delete linkTabs[l.url]; }
  }
  await ensureTabs(true);
  if (startTabId != null) {
    if (saver) saver.prevTabId = startTabId;
    else browser.tabs.update(startTabId, { active: true }).catch(() => {});
  }
}

async function tick() {
  await stateReady;
  await settingsReady;
  try {
    const playing = await browser.tabs.query({ audible: true });
    if (playing.some((t) => !(saver && t.id === saver.tabId))) activity();
  } catch (e) { /* ignore */ }
  const idleMin = (Date.now() - lastActivity) / 60000;
  if (settings.timeoutMin > 0 && idleMin >= settings.timeoutMin && !resetDone) {
    resetDone = true;
    saveState(true);
    await resetToStart();
  }
  if (settings.saverMin > 0 && idleMin >= settings.saverMin && !saver) {
    await openSaver(false);
  }
}
every("tick", 5000, tick);

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
function syncCalendars(force) {
  if (syncing) return syncing;
  syncing = (async () => {
    let cals = [];
    try { cals = (await browser.storage.local.get({ calendars: [] })).calendars || []; } catch (e) { /* none */ }
    const prev = (await browser.storage.local.get({ calData: { events: [], status: {} } })).calData;
    // Chrome wakes this code often: only refresh every 15 minutes unless asked
    if (!force && prev.updated && Date.now() - prev.updated < 14 * 60000) return;
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
syncCalendars(false);
every("calendars", 15 * 60000, () => syncCalendars(false));

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
  // the battery shows on the start page only (not on the E button)
  ACTION.setBadgeText({ text: "" });
  if (!b || !b.present || b.percent == null) return;
  browser.runtime.sendMessage({ type: "battery", battery: b }).catch(() => {});

  // low battery warnings at 20%, 10% and 5% (once each per discharge)
  if (b.plugged || b.charging) {
    if (warned.size) removeNotice("battery");
    warned.clear(); return;
  }
  for (const level of [5, 10, 20]) {
    if (b.percent <= level && !warned.has(level)) {
      [5, 10, 20].filter((x) => x >= level).forEach((x) => warned.add(x));
      const msg = level === 5
        ? "Battery at " + b.percent + "%. Plug in now: EAGLE-OS will shut down at 3% to protect your files."
        : "Battery at " + b.percent + "%. Plug in the charger soon.";
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      const warn = { type: "battery-warn", text: msg, critical: level === 5, accent: currentAccent };
      // only the last-chance 5% warning is shown over the page; the others stay in the panel
      if (tab && warn.critical) browser.tabs.sendMessage(tab.id, warn).catch(() => {});
      browser.runtime.sendMessage(warn).catch(() => {});   // EAGLE pages (start page, settings)
      setNotice({ id: "battery", kind: "battery", title: "Low battery: " + b.percent + "%", text: msg, action: { type: "none" } });
      break;
    }
  }
}
checkBattery();
every("battery", 60000, checkBattery);

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
  if (browser.theme) {   // Firefox only: toolbar colours
    if (currentAccent.toLowerCase() === EAGLE_DEFAULT_ACCENT) {
      try { await browser.theme.reset(); } catch (e) { /* ignore */ }
    } else {
      const colors = {};
      for (const [k, v] of Object.entries(BASE_THEME)) colors[k] = v.toLowerCase() === "#ff7a00" ? currentAccent : v;
      try { await browser.theme.update({ colors }); } catch (e) { /* ignore */ }
    }
  }
  // E button icon (works in both browsers: no page needed)
  try {
    const imageData = {};
    for (const size of [64, 128]) {
      const blob = await (await fetch(browser.runtime.getURL(`icon-${size}.png`))).blob();
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext("2d");
      ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(0, 0, bmp.width, bmp.height);
      eagleTintPixels(d, currentAccent);
      imageData[size] = d;
    }
    await ACTION.setIcon({ imageData });
  } catch (e) { /* keep the packaged icon */ }
}
browser.storage.local.get({ accent: EAGLE_DEFAULT_ACCENT }).then((s) => applyAccent(s.accent));
browser.storage.onChanged.addListener((ch) => { if (ch.accent) applyAccent(ch.accent.newValue); });

// ---------- Tabs: the EAGLE tab is always first, then the link tabs in alphabetical order. ----------
// ---------- All are pinned (icon only) and can't be closed or moved; new tabs open to their right. ----------
// ---------- A link tab loads its site only when clicked. ----------
const START_URL = browser.runtime.getURL("start.html");
const LINKTAB = browser.runtime.getURL("linktab.html");
// Startup: Firefox/Chrome may show a welcome/privacy page or a blank tab before EAGLE is ready.
const STRAY = /^(about:(blank|home|newtab|welcome|privatebrowsing|sessionrestore|tabcrashed)|moz-extension:\/\/[^/]+\/?$|chrome:\/\/(newtab|new-tab-page|welcome|intro|whats-new)|chrome-search:)|^https?:\/\/(www\.)?mozilla\.org\/.*(privacy|firstrun|whatsnew|welcome)|^https?:\/\/(www\.)?firefox\.com\/|^https?:\/\/(www\.)?google\.com\/chrome\//i;
let startTabId = null;
let linkTabs = {};                       // site address -> tab id
const removingLinks = new Set();         // link tabs EAGLE itself is closing (removed in Link tabs)
let activeTabId = null;
browser.tabs.onActivated.addListener((info) => { activeTabId = info.tabId; });
const tabsReady = (async () => {         // Chrome: remember the tab ids across service worker restarts
  if (!EAGLE_IS_CHROME || !browser.storage.session) return;
  try {
    const t = (await browser.storage.session.get("tabs")).tabs;
    if (t) { startTabId = t.startTabId; linkTabs = t.linkTabs || {}; }
  } catch (e) { /* ignore */ }
})();
function saveTabs() {
  if (EAGLE_IS_CHROME && browser.storage.session) browser.storage.session.set({ tabs: { startTabId, linkTabs } }).catch(() => {});
}
function linkTabUrl(l) {
  return LINKTAB + "?u=" + encodeURIComponent(l.url) + "&t=" + encodeURIComponent(l.title) + "&c=" + encodeURIComponent(currentAccent);
}
function placeholderTarget(url) {
  if (!(url || "").startsWith(LINKTAB)) return null;
  try { return new URL(url).searchParams.get("u"); } catch (e) { return null; }
}
const tabUrl = (t) => t.url || t.pendingUrl || "";
let tabsChain = Promise.resolve();
function ensureTabs(create, activateStart) {   // one at a time
  tabsChain = tabsChain.then(() => doEnsureTabs(create, activateStart)).catch(() => {});
  return tabsChain;
}
async function doEnsureTabs(create, activateStart) {
  await tabsReady;
  let win;
  try { win = await browser.windows.getLastFocused({ populate: true, windowTypes: ["normal"] }); } catch (e) { return; }
  if (!win || win.type !== "normal" || !win.tabs) return;
  const tabs = win.tabs;
  suppress();
  // EAGLE tab: first and pinned
  let st = tabs.find((t) => t.id === startTabId) || tabs.find((t) => tabUrl(t).startsWith(START_URL));
  if (!st) st = await browser.tabs.create({ windowId: win.id, url: START_URL, index: 0, pinned: true, active: !!activateStart || tabs.length === 0 });
  startTabId = st.id;
  if (!st.pinned) await browser.tabs.update(st.id, { pinned: true }).catch(() => {});
  if (st.index !== 0) await browser.tabs.move(st.id, { index: 0 }).catch(() => {});

  // link tabs, A to Z
  const links = (await eagleAllLinks()).sort((x, y) => x.title.localeCompare(y.title, undefined, { sensitivity: "base" }));
  const wanted = new Set(links.map((l) => l.url));
  const ids = new Set(tabs.map((t) => t.id));
  for (const u of Object.keys(linkTabs)) if (!ids.has(linkTabs[u])) delete linkTabs[u];
  for (const t of tabs) { const u = placeholderTarget(tabUrl(t)); if (u && linkTabs[u] == null) linkTabs[u] = t.id; }
  for (const u of Object.keys(linkTabs)) {
    if (wanted.has(u)) continue;
    const t = tabs.find((x) => x.id === linkTabs[u]);
    delete linkTabs[u];
    if (t) { removingLinks.add(t.id); await browser.tabs.remove(t.id).catch(() => {}); }
  }
  let index = 1;
  for (const l of links) {
    let id = linkTabs[l.url];
    if (id == null) {
      if (!create) continue;
      const t = await browser.tabs.create({ windowId: win.id, url: linkTabUrl(l), index, pinned: true, active: false }).catch(() => null);
      if (!t) continue;
      id = linkTabs[l.url] = t.id;
      if (relinkActive === l.url) { relinkActive = null; browser.tabs.update(id, { active: true }).catch(() => {}); }
    } else {
      const t = tabs.find((x) => x.id === id);
      if (t && !t.pinned) await browser.tabs.update(id, { pinned: true }).catch(() => {});
      if (t && t.index !== index) await browser.tabs.move(id, { index }).catch(() => {});
    }
    index++;
  }
  saveTabs();
}

// The EAGLE tab and link tabs can't be closed or moved; the EAGLE tab can't be used for other sites
let relinkActive = null;
let fixTimer = null;
function fixTabsSoon() { clearTimeout(fixTimer); fixTimer = setTimeout(() => ensureTabs(false), 300); }
browser.tabs.onRemoved.addListener((tabId, info) => {
  const mine = removingLinks.delete(tabId);
  for (const u of Object.keys(linkTabs)) {
    if (linkTabs[u] !== tabId) continue;
    delete linkTabs[u]; saveTabs();
    if (!mine && !info.isWindowClosing) {
      // closed by hand (middle-click, menu, Ctrl+W): it comes straight back in its place
      if (tabId === activeTabId) relinkActive = u;
      ensureTabs(true);
    }
  }
  if (tabId !== startTabId || info.isWindowClosing) return;
  startTabId = null;
  // closed (Ctrl+W): bring it straight back, in front (after the browser has picked its next tab)
  ensureTabs(false, true).then(() => setTimeout(() => {
    if (startTabId != null) browser.tabs.update(startTabId, { active: true }).catch(() => {});
  }, 400));
});
browser.tabs.onMoved.addListener((tabId, info) => {
  if (tabId === startTabId && info.toIndex !== 0) browser.tabs.move(tabId, { index: 0 }).catch(() => {});
  else if (tabId !== startTabId && info.toIndex === 0 && startTabId != null) browser.tabs.move(startTabId, { index: 0 }).catch(() => {});
  if (Object.values(linkTabs).includes(tabId) || info.toIndex <= Object.keys(linkTabs).length) fixTabsSoon();
});
browser.tabs.onUpdated.addListener((tabId, info) => {
  // unpinned by hand: pin it again
  if (info.pinned === false && (tabId === startTabId || Object.values(linkTabs).includes(tabId))) {
    browser.tabs.update(tabId, { pinned: true }).catch(() => {});
    fixTabsSoon();
  }
  if (tabId !== startTabId || !info.url) return;
  const u = info.url;
  if (u.startsWith(START_URL) || /^(about:blank|chrome:\/\/newtab)/.test(u)) return;
  // something was opened in the EAGLE tab: open it in its own tab, and bring the EAGLE page back
  browser.tabs.create({ url: u, active: true }).catch(() => {});
  browser.tabs.update(tabId, { url: START_URL }).catch(() => {});
});
async function focusStart() {
  await tabsReady;
  if (startTabId == null) await ensureTabs(false);
  if (startTabId != null) {
    const t = await browser.tabs.update(startTabId, { active: true }).catch(() => null);
    if (t) browser.windows.update(t.windowId, { focused: true }).catch(() => {});
  }
}

// Startup: tidy up, then the EAGLE tab + link tabs
let guardUntil = 0;
let guardRuns = 0;
async function startupGuard() {
  if (Date.now() > guardUntil) return;
  await tabsReady;
  let tabs = [];
  try { tabs = await browser.tabs.query({}); } catch (e) { return; }
  // The start page may have tried to load before the add-on was ready: load it again once.
  if (guardRuns++ === 0) {
    for (const t of tabs) if (tabUrl(t).startsWith(START_URL)) browser.tabs.reload(t.id).catch(() => {});
  }
  const ours = new Set([startTabId, ...Object.values(linkTabs)]);
  const hasStart = tabs.some((t) => tabUrl(t).startsWith(START_URL));
  const stray = tabs.filter((t) => !ours.has(t.id) && STRAY.test(tabUrl(t) || "about:blank"));
  if (!hasStart && stray.length) {
    const first = stray.shift();
    await browser.tabs.update(first.id, { url: START_URL }).catch(() => {});
  }
  if (stray.length && stray.length < tabs.length) await browser.tabs.remove(stray.map((t) => t.id)).catch(() => {});
  await ensureTabs(true);
}
function startGuards() {
  guardUntil = Date.now() + 30000;
  guardRuns = 0;
  for (const ms of [800, 3000, 8000, 20000]) setTimeout(startupGuard, ms);
}
// Firefox loads this page once per start; Chrome's service worker restarts often, so use its startup event
if (EAGLE_IS_CHROME) {
  browser.runtime.onStartup.addListener(startGuards);
  browser.runtime.onInstalled.addListener(startGuards);
} else {
  startGuards();
}
browser.storage.onChanged.addListener((ch) => { if (ch.links) ensureTabs(true); });

// ---------- Shared settings: links, calendars, colours and screen timeout are the same in ----------
// ---------- Firefox and Chrome (kept in ~/.config/eagle/addon-settings.json by eagle-native) ----------
const SHARED_KEYS = ["links", "linksVersion", "calendars", "accent", "timeoutMin", "saverMin", "saverTheme"];
let importing = false;
function shareSettings(changes) {
  if (importing || !Object.keys(changes).some((k) => SHARED_KEYS.includes(k))) return;
  browser.storage.local.get(SHARED_KEYS).then((values) => {
    const stamp = Date.now();
    browser.storage.local.set({ sharedStamp: stamp });
    return browser.runtime.sendNativeMessage("eagle", { action: "settings_save", data: { stamp, values } });
  }).catch(() => {});
}
(async () => {
  try {
    const r = await browser.runtime.sendNativeMessage("eagle", { action: "settings_load" });
    const mine = (await browser.storage.local.get({ sharedStamp: 0 })).sharedStamp;
    if (r && r.ok && r.data && r.data.stamp > mine && r.data.values) {
      importing = true;
      await browser.storage.local.set({ ...r.data.values, sharedStamp: r.data.stamp });
      setTimeout(() => { importing = false; }, 1000);
    }
  } catch (e) { importing = false; }
})();

// ---------- Notifications for the start page: email, messages, alerts ----------
let noticeChain = Promise.resolve();
function editNotices(fn) {
  noticeChain = noticeChain.then(async () => {
    const list = (await browser.storage.local.get({ notices: [] })).notices || [];
    const next = fn(list);
    if (next) await browser.storage.local.set({ notices: next.slice(0, 30) });
  }).catch(() => {});
  return noticeChain;
}
function setNotice(n) {
  return editNotices((list) => {
    const old = list.find((x) => x.id === n.id);
    if (old && old.title === n.title && old.text === n.text) return null;       // nothing new
    const keepTime = old && n.keepTime;
    return [{ ...n, time: keepTime ? old.time : (n.time || Date.now()) }].concat(list.filter((x) => x.id !== n.id));
  });
}
function removeNotice(id) {
  return editNotices((list) => (list.some((x) => x.id === id) ? list.filter((x) => x.id !== id) : null));
}

// Gmail: "You have N new emails" when signed in to Gmail in this browser (checked every 5 minutes)
function unescapeXml(t) {
  return (t || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
}
let gmailCount = -1;
async function checkGmail() {
  try {
    const r = await fetch("https://mail.google.com/mail/feed/atom", { credentials: "include", cache: "no-store", redirect: "follow" });
    if (!r.ok) return;
    const x = await r.text();
    const m = /<fullcount>(\d+)<\/fullcount>/.exec(x);
    if (!m) return;                                    // not signed in
    const n = +m[1];
    if (!n) { gmailCount = 0; removeNotice("gmail"); return; }
    const e = /<entry>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<author>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(x);
    setNotice({ id: "gmail", kind: "email", title: n === 1 ? "You have 1 new email" : `You have ${n} new emails`,
      text: e ? unescapeXml(e[2]) + ": " + (unescapeXml(e[1]) || "(no subject)") : "Gmail",
      action: { type: "url", value: "https://mail.google.com/" }, keepTime: n <= gmailCount });
    gmailCount = n;
  } catch (e) { /* offline */ }
}
checkGmail();
every("gmail", 5 * 60000, checkGmail);

// Unread counts that sites show in their tab titles, like "(3) Facebook" or "Inbox (5) - Gmail"
const COUNT_RE = /\((\d{1,4})\+?\)/;
async function siteName(url) {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  const links = await eagleAllLinks();
  const l = links.find((x) => { try { return new URL(x.url).hostname.replace(/^www\./, "") === host; } catch (e) { return false; } });
  return l ? l.title : host;
}
browser.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.title === undefined || !/^https?:/.test(tab.url || "")) return;
  let host = "";
  try { host = new URL(tab.url).hostname; } catch (e) { return; }
  const m = COUNT_RE.exec(info.title);
  const n = m ? +m[1] : 0;
  if (host === "mail.google.com") {
    if (!n) { removeNotice("gmail"); return; }
    setNotice({ id: "gmail", kind: "email", title: n === 1 ? "You have 1 new email" : `You have ${n} new emails`,
      text: "Gmail", action: { type: "tab", value: tabId, url: "https://mail.google.com/" }, keepTime: n <= gmailCount });
    gmailCount = n;
    return;
  }
  const id = "tab:" + host;
  if (!n) { removeNotice(id); return; }
  const name = await siteName(tab.url);
  setNotice({ id, kind: "message", title: `${name}: ${n} new`, text: info.title.replace(COUNT_RE, "").replace(/\s+/g, " ").trim(),
    action: { type: "tab", value: tabId, url: tab.url } });
});

// Opening a notification
async function openNotice(a) {
  if (a.type === "dbus") {
    // a website pop-up: the browser opens the tab it came from (and the site marks it read)
    const r = await browser.runtime.sendNativeMessage("eagle", { action: "notify_click", id: a.value }).catch(() => null);
    removeNotice("dn:" + a.value);
    if (r && r.ok) return;
    if (!a.url) return;
    a = { type: "url", value: a.url };
  }
  if (a.type === "tab") {
    const t = await browser.tabs.update(a.value, { active: true }).catch(() => null);
    if (t) return;
    a = { type: "url", value: a.url };
  }
  if (a.type === "url" && a.value) {
    await tabsReady;
    const id = linkTabs[a.value];
    if (id != null && await browser.tabs.update(id, { active: true }).catch(() => null)) return;
    await browser.tabs.create({ url: a.value, active: true }).catch(() => {});
  } else if (a.type === "page" && a.value) {
    await browser.tabs.create({ url: browser.runtime.getURL(a.value), active: true }).catch(() => {});
  }
}

function webKind(site, title, text) {
  const all = (site + " " + title + " " + text).toLowerCase();
  if (/mail|outlook|inbox/.test(all)) return "email";
  if (/calendar|reminder|meeting|event/.test(all)) return "calendar";
  return "message";
}

// alert() boxes from a tab you're not looking at: noted in the panel instead of
// jumping in front of you. Clicking the note opens that tab, where the box is waiting.
async function pageAlert(msg, sender) {
  const tab = sender && sender.tab;
  if (!tab) return false;
  if (tab.active) {
    // the box is in the tab you're looking at: it shows there as usual
    const w = await browser.windows.get(tab.windowId).catch(() => null);
    if (!w || w.focused) return false;
  }
  let host = "";
  try { host = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) { /* ignore */ }
  const title = String(msg.text || "").trim().slice(0, 200) || "This page needs your attention";
  await setNotice({ id: "alert:" + tab.id + ":" + Date.now(), kind: "info", title: host || tab.title || "A tab",
    text: title, action: { type: "tab", value: tab.id, url: tab.url } });
  return true;
}

// From the system (eagle-key / eagle-notify): MacBook F3 = EAGLE tab, F4 = EAGLE menu; notices
let nativePort = null;
function listenNative() {
  try {
    nativePort = browser.runtime.connectNative("eagle");
    nativePort.onMessage.addListener((ev) => {
      if (!ev || !ev.type) return;
      if (ev.type === "key" && ev.key === "start") focusStart();
      else if (ev.type === "key" && ev.key === "menu") browser.runtime.sendNativeMessage("eagle", { action: "menu" }).catch(() => {});
      else if (ev.type === "notice" && ev.kind === "web") {
        // a website pop-up (Facebook message, Gmail, calendar reminder, ...) caught by eagle-notifyd
        const site = (ev.site || "").replace(/^www\./, "");
        setNotice({ id: "dn:" + ev.notifyId, kind: webKind(site, ev.title, ev.text), title: ev.title || site || "Notification",
          text: [ev.text, site].filter(Boolean).join(" · "),
          action: ev.clickable ? { type: "dbus", value: ev.notifyId, url: site ? "https://" + (ev.site || site) + "/" : "" } : { type: "none" },
          time: ev.time || Date.now() });
      } else if (ev.type === "notice-close") removeNotice("dn:" + ev.notifyId);
      else if (ev.type === "notice") {
        setNotice({ id: "ev:" + ev.kind + ":" + ev.time, kind: ev.kind || "info", title: ev.title || "EAGLE-OS", text: ev.text || "",
          action: ev.screen ? { type: "screen", value: ev.screen } : { type: "none" }, time: ev.time || Date.now() });
      }
    });
    nativePort.onDisconnect.addListener(() => { nativePort = null; setTimeout(listenNative, 10000); });
    nativePort.postMessage({ action: "listen" });
  } catch (e) { setTimeout(listenNative, 10000); }
}
listenNative();
