// EAGLE-OS calendars page: add and remove iCal calendar links (Google, Outlook, iCloud, Yahoo ...).
"use strict";
const COLORS = ["#ff7a00", "#4ea1ff", "#7fb069", "#c77dff", "#ffd166", "#ef6f6c"];
const MAX_CALS = 8;
const $ = (id) => document.getElementById(id);

async function load() {
  const s = await browser.storage.local.get({ calendars: [], calData: { status: {} } });
  return { cals: s.calendars || [], status: (s.calData && s.calData.status) || {} };
}

function ago(ms) {
  if (!ms) return "not yet";
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  return h < 24 ? h + " h ago" : new Date(ms).toLocaleDateString();
}

async function render() {
  const { cals, status } = await load();
  const list = $("list");
  list.textContent = "";
  if (!cals.length) {
    const p = document.createElement("div");
    p.className = "empty";
    p.textContent = "No calendars yet. Add one below.";
    list.appendChild(p);
  }
  for (const c of cals) {
    const st = status[c.id];
    const row = document.createElement("div");
    row.className = "cal-row";
    const sw = document.createElement("span");
    sw.className = "swatch"; sw.style.background = c.color;
    const info = document.createElement("div");
    info.className = "cal-info";
    const name = document.createElement("div");
    name.className = "cal-name"; name.textContent = c.name;
    const state = document.createElement("div");
    state.className = "cal-state";
    if (!st) state.textContent = "Loading…";
    else if (st.ok) state.textContent = st.count + " events · updated " + ago(st.when);
    else { state.classList.add("bad"); state.textContent = st.error + (st.when ? " (showing events from " + ago(st.when) + ")" : ""); }
    info.append(name, state);
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "secondary"; rm.textContent = "Remove";
    rm.addEventListener("click", async () => {
      const now = (await load()).cals.filter((x) => x.id !== c.id);
      await browser.storage.local.set({ calendars: now });
    });
    row.append(sw, info, rm);
    list.appendChild(row);
  }
  // next free colour
  const used = new Set(cals.map((c) => c.color));
  const pick = COLORS.find((x) => !used.has(x)) || COLORS[0];
  if (!document.querySelector("#colors input:checked")) {
    const el = document.querySelector(`#colors input[value="${pick}"]`);
    if (el) el.checked = true;
  }
}

function buildColors() {
  COLORS.forEach((c, i) => {
    const l = document.createElement("label");
    const r = document.createElement("input");
    r.type = "radio"; r.name = "color"; r.value = c;
    r.setAttribute("aria-label", "Colour " + (i + 1));
    const s = document.createElement("span");
    s.style.background = c;
    l.append(r, s);
    $("colors").appendChild(l);
  });
}

function say(text, cls) { const m = $("msg"); m.textContent = text; m.className = cls || ""; }

$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  const raw = $("url").value.trim();
  if (!name || !raw) return;
  const url = EagleICal.normalizeUrl(raw);
  if (/calendar\.google\.com\/calendar\/(u\/\d+\/)?r\b/.test(url) || /\/embed\?/.test(url)) {
    say("That's the Google Calendar page, not its iCal link. Copy the \"Secret address in iCal format\".", "bad"); return;
  }
  const { cals } = await load();
  if (cals.length >= MAX_CALS) { say("Up to " + MAX_CALS + " calendars.", "bad"); return; }
  if (cals.some((c) => EagleICal.normalizeUrl(c.url) === url)) { say("That calendar is already added.", "bad"); return; }
  $("add-btn").disabled = true;
  say("Checking the link…");
  try {
    const r = await fetch(url, { cache: "no-store", credentials: "omit" });
    if (!r.ok) throw new Error("The calendar site answered " + r.status + ". Check the link.");
    const text = await r.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That link isn't an iCal calendar link.");
    const color = (document.querySelector("#colors input:checked") || {}).value || COLORS[0];
    const id = "c" + Date.now().toString(36);
    await browser.storage.local.set({ calendars: [...cals, { id, name, url, color }] });
    $("name").value = ""; $("url").value = "";
    document.querySelectorAll("#colors input").forEach((x) => { x.checked = false; });
    say("Added. Its events are on the start page now.", "good");
  } catch (err) {
    say(err instanceof TypeError ? "Couldn't reach that link. Is the PC online, and is the link complete?" : err.message, "bad");
  } finally { $("add-btn").disabled = false; }
});

$("refresh").addEventListener("click", async () => {
  $("refresh").disabled = true;
  try { await browser.runtime.sendMessage({ type: "cal-refresh" }); } catch (e) { /* ignore */ }
  $("refresh").disabled = false;
  render();
});

browser.storage.onChanged.addListener((ch) => { if (ch.calendars || ch.calData) render(); });
buildColors();
render();
setInterval(render, 60000);
