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
  for (const el of document.querySelectorAll("[data-eagle-action]")) {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      eagle(el.dataset.eagleAction);
    });
  }
})();

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
const cal = { year: 0, month: 0 };

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
    el.textContent = d.getDate();
    grid.appendChild(el);
  }

  document.getElementById("cal-today-text").textContent =
    today.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function goToday() {
  const t = new Date(); cal.year = t.getFullYear(); cal.month = t.getMonth(); renderCalendar();
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
