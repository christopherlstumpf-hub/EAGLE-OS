// EAGLE-OS screensaver: full-screen slideshow of the chosen pictures, with the time.
// Any key, click or a real mouse movement returns to where you were.

const THEMES = ["beach", "mountains", "winter", "summer", "fall", "spring"];
const PER_THEME = 3;
const SLIDE_SECONDS = 20;

function currentSeason(d = new Date()) {
  const m = d.getMonth(); // 0 = January
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function picturesFor(theme) {
  let themes;
  if (theme === "rotate") themes = THEMES;
  else if (THEMES.includes(theme)) themes = [theme];
  else themes = [currentSeason()];
  const list = [];
  for (const t of themes) for (let i = 1; i <= PER_THEME; i++) list.push(`scenes/${t}-${i}.jpg`);
  return shuffle(list);
}

// ---- clock ----
function tick() {
  const d = new Date();
  document.getElementById("time").textContent = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  document.getElementById("date").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
tick();
setInterval(tick, 10000);

// ---- slideshow ----
(async () => {
  let settings = {};
  try { settings = await browser.runtime.sendMessage({ type: "get-settings" }); } catch (e) { settings = {}; }
  // gentle zoom, except on EAGLE-OS Lite (saves the processor)
  try {
    const st = await browser.runtime.sendNativeMessage("eagle", { action: "status" });
    if (!st || st.variant !== "lite") document.documentElement.classList.add("motion");
  } catch (e) { document.documentElement.classList.add("motion"); }

  let list = picturesFor(settings.saverTheme || "season");
  let i = 0;
  const layers = [document.getElementById("a"), document.getElementById("b")];
  let front = 0;

  function show(src) {
    const next = layers[1 - front];
    const img = new Image();
    img.onload = () => {
      next.style.backgroundImage = `url("${src}")`;
      next.classList.remove("show");
      void next.offsetWidth;              // restart the zoom animation
      next.classList.add("show");
      layers[front].classList.remove("show");
      front = 1 - front;
    };
    img.src = src;
  }
  show(list[0]);
  setInterval(() => {
    i = (i + 1) % list.length;
    if (i === 0) list = shuffle(list);
    show(list[i]);
  }, SLIDE_SECONDS * 1000);
})();

// ---- leave on input ----
const opened = Date.now();
let leaving = false;
function leave() {
  if (leaving || Date.now() - opened < 1500) return;   // ignore input right as it opens
  leaving = true;
  browser.runtime.sendMessage({ type: "saver-dismiss" }).catch(() => window.close());
}
let startX = null, startY = null;
window.addEventListener("mousemove", (e) => {
  if (startX === null) { startX = e.screenX; startY = e.screenY; return; }
  if (Math.abs(e.screenX - startX) + Math.abs(e.screenY - startY) > 12) leave();
});
for (const ev of ["keydown", "mousedown", "wheel", "touchstart"]) window.addEventListener(ev, leave, { capture: true });

// preview mode: show a short hint
if (location.hash === "#preview") {
  const h = document.getElementById("hint");
  h.classList.add("show");
  setTimeout(() => h.classList.remove("show"), 4000);
}
