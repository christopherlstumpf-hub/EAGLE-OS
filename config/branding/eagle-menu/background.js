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
browser.storage.onChanged.addListener(() => { loadSettings(); activity(); });

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
