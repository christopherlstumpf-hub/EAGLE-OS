// EAGLE-OS internet speed test (Cloudflare's public speed test servers):
// ping and jitter from small requests, download and upload from timed transfers.
"use strict";
const BASE = "https://speed.cloudflare.com";
const $ = (id) => document.getElementById(id);
const ARC = $("arc"), LEN = ARC.getTotalLength();
ARC.style.strokeDasharray = LEN;
ARC.style.strokeDashoffset = LEN;
function gauge(mbps) {
  $("num").textContent = mbps == null ? "–" : mbps >= 100 ? Math.round(mbps) : mbps.toFixed(1);
  // scale: 0–1000 Mbps on a square-root curve so slow connections still move the needle
  const f = mbps == null ? 0 : Math.min(1, Math.sqrt(Math.max(0, mbps) / 1000));
  ARC.style.strokeDashoffset = LEN * (1 - f);
}
const fmt = (m) => (m >= 100 ? Math.round(m) : m.toFixed(1)) + " <small>Mbps</small>";
function phase(t) { $("phase").textContent = t; }
function on(id) { document.querySelectorAll(".res").forEach((r) => r.classList.toggle("on", r.id === id)); }
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const q90 = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))]; };

async function ping() {
  const times = [];
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now();
    const r = await fetch(`${BASE}/__down?bytes=0&r=${Math.random()}`, { cache: "no-store", credentials: "omit" });
    await r.arrayBuffer();
    times.push(performance.now() - t0);
  }
  times.shift();                       // the first one includes setting up the connection
  const p = median(times);
  let j = 0;
  for (let i = 1; i < times.length; i++) j += Math.abs(times[i] - times[i - 1]);
  return { ping: p, jitter: j / (times.length - 1) };
}

async function download(seconds) {
  const results = [];
  const end = performance.now() + seconds * 1000;
  let size = 1e6;
  while (performance.now() < end) {
    const t0 = performance.now();
    const r = await fetch(`${BASE}/__down?bytes=${size}&r=${Math.random()}`, { cache: "no-store", credentials: "omit" });
    const reader = r.body.getReader();
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      const dt = (performance.now() - t0) / 1000;
      if (dt > 0.2) gauge((got * 8) / dt / 1e6);
    }
    const dt = (performance.now() - t0) / 1000;
    const mbps = (got * 8) / dt / 1e6;
    if (dt > 0.3) results.push(mbps);
    gauge(mbps);
    if (dt < 1.5 && size < 100e6) size *= 4;   // bigger pieces on fast connections
  }
  return results.length ? q90(results) : 0;
}

async function upload(seconds) {
  const results = [];
  const end = performance.now() + seconds * 1000;
  let size = 500e3;
  while (performance.now() < end) {
    const body = new Uint8Array(size);
    const t0 = performance.now();
    const r = await fetch(`${BASE}/__up?r=${Math.random()}`, { method: "POST", body, cache: "no-store", credentials: "omit" });
    await r.arrayBuffer().catch(() => null);
    const dt = (performance.now() - t0) / 1000;
    const mbps = (size * 8) / dt / 1e6;
    if (dt > 0.3) results.push(mbps);
    gauge(mbps);
    if (dt < 1.5 && size < 50e6) size *= 4;
  }
  return results.length ? q90(results) : 0;
}

function verdict(down) {
  if (down >= 100) return "Fast: great for 4K video, video calls and big downloads at the same time.";
  if (down >= 25) return "Good: fine for HD and 4K video and video calls.";
  if (down >= 8) return "OK: fine for HD video, music and video calls.";
  if (down >= 3) return "Slow: fine for web pages, email and music; video may buffer.";
  return "Very slow: web pages may take a while. Try moving closer to the Wi-Fi router.";
}

async function run() {
  $("go").disabled = true;
  ["v-down", "v-up", "v-ping", "v-jit"].forEach((id) => { $(id).textContent = "–"; });
  $("verdict").textContent = "";
  gauge(null);
  try {
    fetch(`${BASE}/meta`, { cache: "no-store", credentials: "omit" }).then((r) => r.json()).then((m) => {
      const where = [m.city, m.region].filter(Boolean).join(", ");
      $("where").textContent = (m.asOrganization ? "Internet provider: " + m.asOrganization : "") +
        (where ? " · Test server near " + where : "");
    }).catch(() => {});
    on("r-ping"); phase("Measuring ping…");
    const p = await ping();
    $("v-ping").innerHTML = Math.round(p.ping) + " <small>ms</small>";
    $("v-jit").innerHTML = Math.round(p.jitter) + " <small>ms</small>";
    on("r-down"); phase("Testing download speed…");
    const d = await download(10);
    $("v-down").innerHTML = fmt(d);
    on("r-up"); phase("Testing upload speed…");
    gauge(null);
    const u = await upload(8);
    $("v-up").innerHTML = fmt(u);
    on(null);
    gauge(d);
    phase("Done. Download speed shown above.");
    $("verdict").textContent = verdict(d);
  } catch (e) {
    on(null); gauge(null);
    phase("The speed test couldn't reach the internet. Check Wi-Fi, then press Start again.");
  }
  $("go").disabled = false;
  $("go").textContent = "Test again";
}
$("go").addEventListener("click", run);
