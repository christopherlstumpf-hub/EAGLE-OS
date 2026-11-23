// EAGLE start page (inside the EAGLE-OS add-on, so it can reach the EAGLE helper):
// Install banner when running from the USB stick / card, EAGLE buttons, clock,
// month calendar and antivirus status.

function eagle(action) {
  return browser.runtime.sendNativeMessage("eagle", { action }).catch(() => null);
}

// ---------- EAGLE status + buttons ----------
(async () => {
  const status = (await eagle("status")) || {};
  document.documentElement.dataset.eagle = "ready";
  if (status.live) document.documentElement.dataset.live = "yes";
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-eagle-action]");
    if (!el) return;
    if (document.documentElement.classList.contains("editing") && el.closest("#tiles")) return;
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

// ---------- Clock ----------
function tick() {
  const d = new Date();
  document.getElementById("clock").textContent =
    d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + "  ·  " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
tick();
setInterval(tick, 15000);

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
function calColor(e) { const c = calCals.find((x) => x.id === e.cal); return c ? c.color : "#ff7a00"; }
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
    a.className = "cal-connect"; a.href = "calendars.html";
    a.textContent = "+ Show your Google, Outlook or iCloud calendar here";
    box.appendChild(a);
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

// ---------- Antivirus status ----------
function when(iso) {
  if (!iso) return "never";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " +
         d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

async function renderSecurity() {
  const s = await eagle("security_status");
  const dot = document.getElementById("sec-dot");
  const title = document.getElementById("sec-title");
  const lines = document.getElementById("sec-lines");
  dot.className = "dot";
  if (!s || !s.ok) { title.textContent = "Antivirus status unavailable"; lines.textContent = ""; return; }

  if (s.threats_found > 0) {
    dot.classList.add("bad");
    title.textContent = `${s.threats_found} threat${s.threats_found === 1 ? "" : "s"} quarantined`;
  } else if (!s.signatures) {
    dot.classList.add("warn");
    title.textContent = s.live ? "Antivirus ready (not set up from USB)" : "Getting virus definitions…";
  } else {
    dot.classList.add("ok");
    title.textContent = "Protected";
  }

  const out = [];
  out.push(s.realtime ? "Watching downloads in real time" : (s.live ? "Scans available from Security" : "Scheduled scans of downloads"));
  out.push("Virus definitions: " + (s.signatures ? when(s.signatures) : "not downloaded yet"));
  out.push("Last scan: " + when(s.last_scan) + (s.last_scan && s.last_scan_threats === 0 ? " · clean" : ""));
  lines.innerHTML = "";
  for (const t of out) { const div = document.createElement("div"); div.textContent = t; lines.appendChild(div); }
}
renderSecurity();
setInterval(renderSecurity, 5 * 60 * 1000);

// ---------- Screensaver summary ----------
(async () => {
  const NAMES = { beach: "Beach", mountains: "Mountains", winter: "Winter", summer: "Summer", fall: "Fall", spring: "Spring" };
  const m = new Date().getMonth();
  const season = m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "fall" : "winter";
  let s = { timeoutMin: 0, saverMin: 10, saverTheme: "season" };
  try { s = { ...s, ...(await browser.storage.local.get(s)) }; } catch (e) { /* defaults */ }
  const theme = s.saverTheme === "season" ? season : (s.saverTheme === "rotate" ? "mountains" : s.saverTheme);
  document.getElementById("saver-thumb").style.backgroundImage = `url("scenes/thumbs/${theme}.jpg")`;
  const pics = s.saverTheme === "season" ? `Current season (${NAMES[season]})` : s.saverTheme === "rotate" ? "Rotate all" : NAMES[s.saverTheme];
  const lines = document.getElementById("saver-lines");
  lines.innerHTML = "";
  for (const t of [
    "Pictures: " + pics,
    "Starts after: " + (s.saverMin ? `${s.saverMin} min` : "off"),
    "Return to start page: " + (s.timeoutMin ? `${s.timeoutMin} min` : "off"),
  ]) { const d = document.createElement("div"); d.textContent = t; lines.appendChild(d); }
})();

// ---------- Link buttons: six fixed + your own (add / remove) ----------
const FIXED_LINKS = [
  { title: "Google", url: "https://www.google.com" },
  { title: "Gmail", url: "https://mail.google.com" },
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "Maps", url: "https://maps.google.com" },
  { title: "News", url: "https://news.google.com" },
  { title: "Weather", url: "https://weather.com" },
];
const STARTER_LINKS = [
  { title: "Spotify", url: "https://open.spotify.com/" },
  { title: "Camera test", url: "camera.html" },
  { title: "Wi-Fi", action: "wifi" },
  { title: "EAGLE menu", action: "menu" },
];
const MAX_LINKS = 24;
let myLinks = [];

async function loadLinks() {
  try {
    const s = await browser.storage.local.get({ links: null });
    myLinks = Array.isArray(s.links) ? s.links : STARTER_LINKS.slice();
  } catch (e) { myLinks = STARTER_LINKS.slice(); }
}
async function saveLinks() { try { await browser.storage.local.set({ links: myLinks }); } catch (e) { /* ignore */ } }

function tile(link, cls, index) {
  const wrap = document.createElement("div");
  wrap.className = "tile " + cls;
  const a = document.createElement("a");
  a.textContent = link.title;
  a.title = link.url || link.title;
  if (link.action) { a.href = "#"; a.dataset.eagleAction = link.action; }
  else a.href = link.url;
  wrap.appendChild(a);
  if (cls === "removable") {
    const x = document.createElement("button");
    x.type = "button"; x.className = "remove"; x.textContent = "✕";
    x.setAttribute("aria-label", "Remove " + link.title);
    x.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      myLinks.splice(index, 1);
      await saveLinks();
      renderTiles();
    });
    wrap.appendChild(x);
  }
  return wrap;
}

function renderTiles() {
  const box = document.getElementById("tiles");
  box.textContent = "";
  FIXED_LINKS.forEach((l) => box.appendChild(tile(l, "fixed")));
  myLinks.forEach((l, i) => box.appendChild(tile(l, "removable", i)));
  if (myLinks.length < MAX_LINKS) {
    const add = tile({ title: "+ Add link" }, "add-tile");
    add.querySelector("a").href = "#";
    add.querySelector("a").addEventListener("click", (ev) => { ev.preventDefault(); openAddForm(); });
    box.appendChild(add);
  }
}

function normaliseUrl(text) {
  let t = text.trim();
  if (!t) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = "https://" + t;
  try {
    const u = new URL(t);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return null;
    return u.href;
  } catch (e) { return null; }
}

function openAddForm() {
  const f = document.getElementById("add-form");
  f.hidden = false;
  document.getElementById("add-error").textContent = "";
  document.getElementById("add-name").value = "";
  document.getElementById("add-url").value = "";
  document.getElementById("add-name").focus();
}

document.getElementById("add-cancel").addEventListener("click", () => { document.getElementById("add-form").hidden = true; });
document.getElementById("add-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const name = document.getElementById("add-name").value.trim();
  const url = normaliseUrl(document.getElementById("add-url").value);
  const err = document.getElementById("add-error");
  if (!name) { err.textContent = "Give the link a name."; return; }
  if (!url) { err.textContent = "That web address doesn't look right. Try something like facebook.com"; return; }
  myLinks.push({ title: name.slice(0, 24), url });
  await saveLinks();
  document.getElementById("add-form").hidden = true;
  renderTiles();
});
document.getElementById("edit-links").addEventListener("click", () => {
  const on = document.documentElement.classList.toggle("editing");
  document.getElementById("edit-links").textContent = on ? "Done" : "Edit links";
});

// While editing, clicking a button does nothing (only the ✕ removes it)
document.getElementById("tiles").addEventListener("click", (ev) => {
  if (!document.documentElement.classList.contains("editing")) return;
  if (ev.target.closest(".remove") || ev.target.closest(".add-tile")) return;
  ev.preventDefault();
  ev.stopPropagation();
}, true);

loadLinks().then(renderTiles);
