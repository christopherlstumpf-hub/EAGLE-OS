// EAGLE-OS: connect Google Calendar without hunting for the "secret address".
// Runs on calendar.google.com. While a "Connect Google Calendar" is under way it shows a small
// EAGLE helper box, goes to your calendar's settings, points at the secret address and picks it
// up as soon as it's on the page (or copied). The address stays on this PC.
"use strict";
(() => {
  if (window.top !== window || window.__eagleGcal) return;
  window.__eagleGcal = true;

  const ICAL_RE = /https:\/\/calendar\.google\.com\/calendar\/ical\/[^\s"'<>\/]+\/private-[0-9a-f]{16,}\/basic\.ics/i;
  let active = false, done = false, sent = "", box = null, msgEl = null, btnEl = null;

  // ---- the helper box (shadow DOM so Google's styles can't touch it) ----
  function ui() {
    if (box) return;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>
      .b{width:340px;background:#111;color:#e6e6e6;border:2px solid #ff7a00;border-radius:14px;
         box-shadow:0 10px 30px rgba(0,0,0,.45);font:14px/1.45 "Noto Sans","DejaVu Sans",Arial,sans-serif;padding:14px 16px}
      .h{display:flex;align-items:center;gap:8px;font-weight:700;color:#fff;font-size:15px;margin-bottom:6px}
      .e{width:22px;height:22px;border-radius:50%;background:#ff7a00;color:#000;display:grid;place-items:center;font-weight:900;font-size:13px}
      .x{margin-left:auto;background:none;border:0;color:#999;font-size:18px;cursor:pointer}
      .m b{color:#fff} .m ol{margin:6px 0 0;padding-left:18px}
      .go{margin-top:10px;background:#ff7a00;color:#000;border:0;border-radius:8px;padding:9px 14px;font:inherit;font-weight:700;cursor:pointer}
    </style><div class="b"><div class="h"><span class="e">E</span>EAGLE-OS · Connect Google Calendar<button class="x" title="Stop">✕</button></div>
      <div class="m"></div><button class="go" hidden></button></div>`;
    msgEl = root.querySelector(".m"); btnEl = root.querySelector(".go");
    root.querySelector(".x").addEventListener("click", () => {
      browser.runtime.sendMessage({ type: "gcal-cancel" }).catch(() => {});
      host.remove(); box = null; active = false;
    });
    (document.body || document.documentElement).appendChild(host);
    box = host;
  }
  function say(html, button, onClick) {
    ui();
    msgEl.innerHTML = html;
    btnEl.hidden = !button;
    if (button) { btnEl.textContent = button; btnEl.onclick = onClick; }
  }

  // ---- find the address on the page or in what's copied ----
  function found(url) {
    if (!active || done || !url) return;
    const m = ICAL_RE.exec(url);
    if (!m || m[0] === sent) return;
    sent = m[0];
    say("Found it. Checking your calendar…");
    browser.runtime.sendMessage({ type: "gcal-found", url: m[0], title: calendarName() }).then((r) => {
      if (r && r.ok) {
        done = true;
        say("<b>✓ Connected.</b> " + (r.already ? "This calendar was already on" : "Your events are now on") +
          " the EAGLE tab and refresh every 15 minutes.", "Back to the EAGLE tab",
          () => browser.runtime.sendMessage({ type: "gcal-finish" }).catch(() => {}));
      } else {
        sent = "";
        say("That address didn't work: " + esc((r && r.error) || "no answer") + "<br>Try the copy button next to it again.");
      }
    }).catch(() => { sent = ""; });
  }
  function scan() {
    if (!active || done) return;
    for (const el of document.querySelectorAll("input, textarea")) if (el.value && ICAL_RE.test(el.value)) return found(el.value);
    const t = document.body && document.body.innerText;
    if (t && ICAL_RE.test(t)) found(t);
  }
  document.addEventListener("copy", () => setTimeout(() => found(String(document.getSelection() || "")), 0), true);
  // Google's copy button writes straight to the clipboard: catch that too
  if (typeof exportFunction === "function" && window.wrappedJSObject) {
    try {   // Firefox
      const page = window.wrappedJSObject, clip = page.navigator.clipboard, orig = clip && clip.writeText;
      if (orig) exportFunction(function (t) { found(String(t)); return orig.call(clip, t); }, clip, { defineAs: "writeText" });
    } catch (e) { /* ignore */ }
  } else {
    document.addEventListener("eagle-clip", (ev) => found(String(ev.detail || "")), true);   // Chrome: gcal-hook.js
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
  function calendarName() {
    const h = document.querySelector("[role=main] h2, [role=main] h1");
    return h ? h.textContent.trim().slice(0, 40) : "";
  }

  // ---- walk the person to the right spot ----
  function findLabel() {
    const want = /secret address in ical format/i;
    const all = document.querySelectorAll("div, span, label, h3, h4");
    for (const el of all) if (el.childElementCount < 3 && want.test(el.textContent) && el.textContent.length < 60) return el;
    return null;
  }
  let pointed = false, hopped = false;
  function guide() {
    if (!active || done) return;
    const path = location.pathname;
    if (/\/r\/settings\/calendar\//.test(path)) {
      const lab = findLabel();
      if (lab && !pointed) {
        pointed = true;
        // outline the label together with its address box and buttons
        let sec = lab;
        for (let i = 0; i < 4 && sec.parentElement && !sec.querySelector("input, button, [role=button]"); i++) sec = sec.parentElement;
        sec.scrollIntoView({ block: "center", behavior: "smooth" });
        sec.style.outline = "3px solid #ff7a00"; sec.style.outlineOffset = "6px"; sec.style.borderRadius = "6px";
      }
      say(lab
        ? "Almost done. Next to <b>Secret address in iCal format</b> (outlined in orange), click the <b>eye</b> to show it or the <b>copy</b> button. EAGLE picks it up by itself."
        : "Scroll down to <b>Integrate calendar</b>, then click the copy button next to <b>Secret address in iCal format</b>. EAGLE picks it up by itself.");
    } else if (/\/r\/settings/.test(path)) {
      // jump to the first of "Settings for my calendars" (your main calendar)
      const link = [...document.querySelectorAll("a[href*='/r/settings/calendar/']")][0];
      if (link && !hopped) { hopped = true; say("Opening your calendar's settings…"); link.click(); return; }
      say("On the left, under <b>Settings for my calendars</b>, click the calendar you want on the EAGLE tab.");
    } else {
      say("Taking you to your calendar settings…");
      if (!hopped) { hopped = true; location.href = "https://calendar.google.com/calendar/u/0/r/settings"; }
    }
  }

  let timer = null;
  function tick() { clearTimeout(timer); timer = setTimeout(() => { scan(); guide(); }, 400); }

  browser.runtime.sendMessage({ type: "gcal-state" }).then((r) => {
    if (!r || !r.active) return;
    active = true;
    tick();
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(tick, 1500);   // Google changes pages without reloading
  }).catch(() => {});
})();
