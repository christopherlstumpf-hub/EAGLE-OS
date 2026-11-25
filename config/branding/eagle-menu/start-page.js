// EAGLE start page (the pinned first tab): analog clock, battery, notifications and the
// month calendar. No buttons: the sites open as tabs next to this one (E menu > Link tabs).

function eagle(action) {
  return browser.runtime.sendNativeMessage("eagle", { action }).catch(() => null);
}
let eagleStatus = {};

// ---------- EAGLE status (version, running from the stick) ----------
(async () => {
  const status = (await eagle("status")) || {};
  eagleStatus = status;
  document.documentElement.dataset.eagle = "ready";
  if (status.live) document.documentElement.dataset.live = "yes";
  if (status.version) {
    const v = document.getElementById("version");
    const ver = status.version.replace(/^build\s*/i, "Build ");
    v.textContent = "EAGLE-OS" + (status.variant === "lite" ? " Lite" : "") + " · " + ver;
    if (status.built) v.title = "Built " + status.built;
    v.hidden = false;
  }
  renderNotes();
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-eagle-action]");
    if (!el) return;
    ev.preventDefault();
    eagle(el.dataset.eagleAction);
  });
})();

// ---------- Battery (laptops) ----------
function showBattery(b) {
  const el = document.getElementById("battery");
  if (!b || !b.present || b.percent == null) { el.classList.add("hidden"); return; }
  el.className = "battery";
  const low = !b.plugged && !b.charging && b.percent <= 20;
  if (low) el.classList.add("low");
  if (b.charging || b.plugged) el.classList.add("charging");
  el.textContent = "";
  const icon = document.createElement("span"); icon.className = "batt-icon";
  const fill = document.createElement("span"); fill.className = "batt-fill";
  fill.style.width = "calc(" + Math.max(4, b.percent) + "% - 2px)";
  icon.appendChild(fill);
  el.appendChild(icon);
  if (b.charging || b.plugged) { const z = document.createElement("span"); z.className = "batt-bolt"; z.textContent = "⚡"; el.appendChild(z); }
  const h = b.minutes != null ? (b.minutes >= 60 ? Math.floor(b.minutes / 60) + " h " + (b.minutes % 60) + " min" : b.minutes + " min") : "";
  let t = b.percent + "%";
  if (b.charging) t += " · Charging" + (h ? " · full in " + h : "");
  else if (b.plugged) t += b.full || b.percent >= 99 ? " · Plugged in, fully charged" : " · Plugged in";
  else t += " · On battery" + (h ? " · about " + h + " left" : "");
  el.appendChild(document.createTextNode(t));
}
(async () => {
  let b = null;
  try { b = await browser.runtime.sendMessage({ type: "get-battery" }); } catch (e) { /* ignore */ }
  if (!b) b = await eagle("battery");
  showBattery(b);
})();
browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "battery") showBattery(msg.battery);
  return undefined;
});

// ---------- Wi-Fi meter (click: Wi-Fi screen) ----------
function showNetwork(n) {
  const el = document.getElementById("wifi");
  if (!n || !n.ok) { el.hidden = true; return; }
  el.hidden = false;
  let bars = 0, cls = "", name = "", state = "";
  const online = n.connectivity === "full";
  if (n.kind === "wifi") {
    const sig = n.signal || 0;
    bars = sig >= 75 ? 4 : sig >= 50 ? 3 : sig >= 25 ? 2 : 1;
    name = n.ssid || "Wi-Fi";
    state = online ? "" : n.connectivity === "portal" ? "Sign-in needed" : "No internet";
    cls = online ? (bars >= 2 ? "good" : "warn") : "warn";
  } else if (n.kind === "wired") {
    bars = 4; name = "Wired"; state = online ? "" : "No internet"; cls = online ? "good" : "warn";
  } else {
    bars = 0; name = ""; state = "Not connected"; cls = "off";
  }
  el.className = "wifi " + cls;
  el.textContent = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 16");
  for (let i = 0; i < 4; i++) {
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const h = 4 + i * 4;
    r.setAttribute("x", i * 5); r.setAttribute("y", 16 - h); r.setAttribute("width", 4); r.setAttribute("height", h); r.setAttribute("rx", 1);
    r.setAttribute("class", "b" + (i < bars ? " on" : ""));
    svg.appendChild(r);
  }
  el.appendChild(svg);
  if (name) { const s = document.createElement("span"); s.className = "name"; s.textContent = name; el.appendChild(s); }
  const st = document.createElement("span");
  st.textContent = state ? (name ? "· " : "") + state : (n.kind === "wifi" ? "· " + (n.signal || 0) + "%" : "· Online");
  el.appendChild(st);
  el.title = n.kind === "wifi" ? `Wi-Fi: ${name}, signal ${n.signal}%${state ? ", " + state : ", online"}` : (state || "Online") + " · click for Wi-Fi and network";
}
async function checkNetwork() { showNetwork(await eagle("network")); }
checkNetwork();
setInterval(checkNetwork, 15000);
window.addEventListener("online", checkNetwork);
window.addEventListener("offline", checkNetwork);

// ---------- Analog clock + date ----------
const SVGNS = "http://www.w3.org/2000/svg";
function svg(tag, attrs, parent) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  parent.appendChild(el);
  return el;
}
const face = document.getElementById("analog");
svg("circle", { class: "face", cx: 100, cy: 100, r: 96 }, face);
for (let i = 0; i < 60; i++) {
  const big = i % 5 === 0, a = (i * 6) * Math.PI / 180, r1 = big ? 80 : 86, r2 = 91;
  svg("line", { class: "tick" + (big ? " big" : ""), x1: 100 + r1 * Math.sin(a), y1: 100 - r1 * Math.cos(a), x2: 100 + r2 * Math.sin(a), y2: 100 - r2 * Math.cos(a) }, face);
}
for (const n of [12, 3, 6, 9]) {
  const a = n * 30 * Math.PI / 180;
  const t = svg("text", { class: "num", x: 100 + 66 * Math.sin(a), y: 100 - 66 * Math.cos(a) }, face);
  t.textContent = n;
}
const hHand = svg("line", { class: "hour", x1: 100, y1: 108, x2: 100, y2: 52 }, face);
const mHand = svg("line", { class: "min", x1: 100, y1: 112, x2: 100, y2: 30 }, face);
const sHand = svg("line", { class: "sec", x1: 100, y1: 118, x2: 100, y2: 22 }, face);
svg("circle", { class: "hub", cx: 100, cy: 100, r: 5 }, face);
function clockTick() {
  const d = new Date();
  const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  hHand.setAttribute("transform", `rotate(${h * 30} 100 100)`);
  mHand.setAttribute("transform", `rotate(${m * 6} 100 100)`);
  sHand.setAttribute("transform", `rotate(${s * 6} 100 100)`);
  const date = document.getElementById("date");
  const day = d.toLocaleDateString(undefined, { weekday: "long" });
  const rest = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.dataset.v !== day + rest + time) {
    date.dataset.v = day + rest + time;
    date.textContent = "";
    const b = document.createElement("b"); b.textContent = time;
    date.append(b, document.createTextNode(day + ", " + rest));
  }
}
clockTick();
setInterval(clockTick, 1000);

// ---------- Month calendar ----------
const cal = { year: 0, month: 0, selected: null };
let calCals = [], calEvents = [];

function dayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
// events on a given day (multi-day events count on every day they cover)
function eventsOn(d) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return calEvents.filter((e) => e.start < b && (e.end > a || (e.end === e.start && e.start >= a)));
}
function calColor(e) { const c = calCals.find((x) => x.id === e.cal); return c ? c.color : "var(--orange)"; }
function evTime(e, d) {
  if (e.allDay) return "All day";
  const s = new Date(e.start);
  if (d && !sameDay(s, d)) return "…";
  return s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function evRow(e, label) {
  const row = document.createElement("div"); row.className = "ev";
  const bar = document.createElement("span"); bar.className = "evbar"; bar.style.background = calColor(e);
  const t = document.createElement("span"); t.className = "t"; t.textContent = label;
  const n = document.createElement("span"); n.className = "n"; n.textContent = e.title + (e.location ? " · " + e.location : "");
  row.append(bar, t, n);
  return row;
}
function renderEvents() {
  const box = document.getElementById("cal-events");
  box.textContent = "";
  if (!calCals.length) {
    const a = document.createElement("a");
    a.className = "cal-connect"; a.href = "#";
    a.textContent = "+ Connect Google Calendar";
    a.addEventListener("click", (ev) => { ev.preventDefault(); browser.runtime.sendMessage({ type: "gcal-start" }).catch(() => {}); });
    const o = document.createElement("a");
    o.className = "cal-connect"; o.href = "calendars.html"; o.target = "_blank";
    o.textContent = "+ Outlook, iCloud or another calendar";
    box.append(a, o);
    return;
  }
  const day = cal.selected || new Date();
  const h = document.createElement("h3");
  h.textContent = sameDay(day, new Date()) ? "Today" : day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  box.appendChild(h);
  const list = eventsOn(day);
  if (!list.length) {
    const p = document.createElement("div"); p.className = "ev-none"; p.textContent = "Nothing scheduled";
    box.appendChild(p);
  }
  for (const e of list.slice(0, 8)) box.appendChild(evRow(e, evTime(e, day)));

  // coming up: next 4 after the selected day, within 2 weeks
  const after = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  const next = calEvents.filter((e) => e.start >= Math.max(after, Date.now()) && e.start < after + 14 * 86400000).slice(0, 4);
  if (next.length) {
    const h2 = document.createElement("h3"); h2.textContent = "Coming up"; h2.style.marginTop = "10px";
    box.appendChild(h2);
    for (const e of next) {
      const s = new Date(e.start);
      const label = s.toLocaleDateString(undefined, { weekday: "short" }) + (e.allDay ? "" : " " + s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
      box.appendChild(evRow(e, label));
    }
  }
}
async function loadCalendarData() {
  try {
    const s = await browser.storage.local.get({ calendars: [], calData: { events: [] } });
    calCals = s.calendars || [];
    calEvents = (s.calData && s.calData.events || []).filter((e) => calCals.some((c) => c.id === e.cal));
  } catch (e) { calCals = []; calEvents = []; }
  renderCalendar();
  renderNotes();
}
browser.storage.onChanged.addListener((ch) => { if (ch.calendars || ch.calData) loadCalendarData(); });

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function renderCalendar() {
  const today = new Date();
  const first = new Date(cal.year, cal.month, 1);
  const grid = document.getElementById("cal-grid");
  document.getElementById("cal-title").textContent =
    first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  grid.textContent = "";

  // weekday headers, Sunday first
  const sunday = new Date(2023, 0, 1); // a Sunday
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday); d.setDate(sunday.getDate() + i);
    const el = document.createElement("div");
    el.className = "dow";
    el.textContent = d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
    grid.appendChild(el);
  }

  // 6 weeks, starting on the Sunday on or before the 1st
  const start = new Date(first); start.setDate(1 - first.getDay());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const el = document.createElement("div");
    el.className = "day";
    if (d.getMonth() !== cal.month) el.classList.add("other");
    if (d.getDay() === 0 || d.getDay() === 6) el.classList.add("weekend");
    if (sameDay(d, today)) { el.classList.add("today"); el.setAttribute("aria-current", "date"); }
    if (cal.selected && sameDay(d, cal.selected)) el.classList.add("sel");
    el.textContent = d.getDate();
    const evs = calEvents.length ? eventsOn(d) : [];
    if (evs.length) {
      const dots = document.createElement("span"); dots.className = "dots";
      const colors = [...new Set(evs.map(calColor))].slice(0, 3);
      for (const c of colors) { const i = document.createElement("i"); i.style.background = c; dots.appendChild(i); }
      dots.setAttribute("aria-hidden", "true");
      el.appendChild(dots);
      el.title = evs.length + (evs.length === 1 ? " event" : " events");
    }
    el.addEventListener("click", () => { cal.selected = d; renderCalendar(); });
    grid.appendChild(el);
  }
  renderEvents();

}

function goToday() {
  const t = new Date(); cal.year = t.getFullYear(); cal.month = t.getMonth(); cal.selected = null; renderCalendar();
}
function shiftMonth(n) {
  const d = new Date(cal.year, cal.month + n, 1); cal.year = d.getFullYear(); cal.month = d.getMonth(); renderCalendar();
}
document.getElementById("cal-prev").addEventListener("click", () => shiftMonth(-1));
document.getElementById("cal-next").addEventListener("click", () => shiftMonth(1));
const todayLink = document.getElementById("cal-today");
todayLink.addEventListener("click", goToday);
todayLink.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") goToday(); });
goToday();
loadCalendarData();
// roll over at midnight
setInterval(() => { const t = new Date(); if (t.getHours() === 0 && t.getMinutes() === 0) goToday(); }, 60000);


// ---------- Notifications: alerts, messages, email, calendar ----------
// From the EAGLE add-on (storage "notices": email, unread messages in open tabs, antivirus, updates,
// battery) plus a few worked out here (install from the stick, calendar events coming up).
const ICONS = { install: "⬇", calendar: "📅", email: "✉", message: "💬", security: "🛡", updates: "⟳", battery: "🔋", info: "ℹ" };
let notices = [], dismissed = {};
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + " h ago";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function computedNotes() {
  const out = [];
  if (eagleStatus.live) {
    out.push({ id: "install", kind: "install", title: "Install EAGLE-OS on this PC",
      text: "You're running from a USB stick or card. Install to keep your Wi-Fi, settings and updates.",
      action: { type: "screen", value: "install" }, time: 0 });
  }
  const now = Date.now();
  for (const e of calEvents) {
    if (e.allDay) continue;
    if (e.start > now && e.start - now <= 60 * 60000) {
      const mins = Math.round((e.start - now) / 60000);
      out.push({ id: "cal:" + e.start + ":" + e.title, kind: "calendar", title: e.title,
        text: new Date(e.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + " · in " + mins + " min" + (e.location ? " · " + e.location : ""),
        action: { type: "none" }, time: e.start, soon: true });
    }
  }
  return out;
}
function renderNotes() {
  const list = computedNotes().concat(notices).filter((n) => !dismissed[n.id]);
  const rank = (n) => (n.id === "install" ? 2 : n.soon ? 1 : 0);
  list.sort((a, b) => rank(b) - rank(a) || (b.time || 0) - (a.time || 0));
  const box = document.getElementById("notes");
  box.textContent = "";
  const count = document.getElementById("note-count");
  count.hidden = !list.length; count.textContent = list.length;
  // the pinned EAGLE tab gets a dot in the tab bar when its title changes
  document.title = list.length ? "(" + list.length + ") EAGLE-OS" : "EAGLE-OS";
  document.getElementById("clear-all").hidden = list.length < 2;
  if (!list.length) {
    const e = document.createElement("div"); e.className = "empty";
    const b = document.createElement("b"); b.textContent = "You're all caught up";
    e.append(b, document.createTextNode("New email, messages and alerts show up here."));
    box.appendChild(e);
    return;
  }
  for (const n of list.slice(0, 20)) {
    const row = document.createElement("div");
    row.className = "note" + (["security", "battery"].includes(n.kind) ? " alert" : "");
    row.tabIndex = 0;
    const ic = document.createElement("span"); ic.className = "ic"; ic.textContent = ICONS[n.kind] || ICONS.info;
    const tx = document.createElement("div"); tx.className = "tx";
    const tt = document.createElement("div"); tt.className = "tt"; tt.textContent = n.title;
    tx.appendChild(tt);
    if (n.text) { const bd = document.createElement("div"); bd.className = "bd"; bd.textContent = n.text; tx.appendChild(bd); }
    if (n.time && !n.soon) { const tm = document.createElement("div"); tm.className = "tm"; tm.textContent = ago(n.time); tx.appendChild(tm); }
    const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "✕";
    x.setAttribute("aria-label", "Dismiss");
    x.addEventListener("click", (ev) => { ev.stopPropagation(); dismiss([n.id]); });
    row.append(ic, tx, x);
    const open = () => {
      const a = n.action || {};
      if (a.type === "screen") eagle(a.value);
      else if (a.type && a.type !== "none") browser.runtime.sendMessage({ type: "open-notice", action: a }).catch(() => {});
    };
    row.addEventListener("click", open);
    row.addEventListener("keydown", (ev) => { if (ev.key === "Enter") open(); });
    box.appendChild(row);
  }
}
async function dismiss(ids) {
  for (const id of ids) dismissed[id] = Date.now();
  const web = ids.filter((id) => id.startsWith("dn:"));
  if (web.length) browser.runtime.sendMessage({ type: "web-dismissed", ids: web }).catch(() => {});
  // forget dismissals older than a week
  for (const id in dismissed) if (Date.now() - dismissed[id] > 7 * 86400000) delete dismissed[id];
  renderNotes();
  try { await browser.storage.local.set({ noticeDismissed: dismissed }); } catch (e) { /* ignore */ }
}
document.getElementById("clear-all").addEventListener("click", () => {
  dismiss(computedNotes().concat(notices).map((n) => n.id));
});
async function loadNotes() {
  try {
    const s = await browser.storage.local.get({ notices: [], noticeDismissed: {} });
    notices = s.notices || []; dismissed = s.noticeDismissed || {};
  } catch (e) { /* ignore */ }
  renderNotes();
}
browser.storage.onChanged.addListener((ch) => { if (ch.notices || ch.noticeDismissed) loadNotes(); });
loadNotes();
setInterval(renderNotes, 60000);
