// EAGLE-OS screen timeout and screensaver settings (saved in the browser profile).
const DEFAULTS = { timeoutMin: 0, saverMin: 10, saverTheme: "season" };
const MINUTES = [[0, "Off"], [5, "5 minutes"], [10, "10 minutes"], [30, "30 minutes"], [60, "60 minutes"]];
const SAVER_MINUTES = [[0, "Off"], [1, "1 minute"], [5, "5 minutes"], [10, "10 minutes"], [30, "30 minutes"], [60, "60 minutes"]];
const THEMES = [["beach", "Beach"], ["mountains", "Mountains"], ["winter", "Winter"],
                ["summer", "Summer"], ["fall", "Fall"], ["spring", "Spring"]];

function currentSeason(d = new Date()) {
  const m = d.getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

let savedTimer;
async function save(patch) {
  await browser.storage.local.set(patch);
  const s = document.getElementById("saved");
  s.classList.add("show");
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => s.classList.remove("show"), 1500);
}

function radioRow(containerId, name, value, key, options = MINUTES) {
  const box = document.getElementById(containerId);
  for (const [v, label] of options) {
    const l = document.createElement("label");
    const i = document.createElement("input");
    i.type = "radio"; i.name = name; i.value = v; i.checked = v === value;
    i.addEventListener("change", () => save({ [key]: v }));
    const s = document.createElement("span"); s.textContent = label;
    l.append(i, s); box.appendChild(l);
  }
}

function picCard(value, label, checked, thumbHTML) {
  const l = document.createElement("label");
  const i = document.createElement("input");
  i.type = "radio"; i.name = "theme"; i.value = value; i.checked = checked;
  i.addEventListener("change", () => save({ saverTheme: value }));
  const card = document.createElement("div"); card.className = "pic";
  card.innerHTML = thumbHTML;
  const n = document.createElement("div"); n.className = "name"; n.textContent = label;
  card.appendChild(n);
  l.append(i, card);
  return l;
}

(async () => {
  const s = { ...DEFAULTS, ...(await browser.storage.local.get(DEFAULTS)) };
  radioRow("timeout", "timeout", s.timeoutMin, "timeoutMin");
  radioRow("saver", "saver", s.saverMin, "saverMin", SAVER_MINUTES);

  const pics = document.getElementById("pics");
  const season = currentSeason();
  const seasonName = THEMES.find(([t]) => t === season)[1];
  pics.appendChild(picCard("season", `Current season (${seasonName})`, s.saverTheme === "season",
    `<div class="img" style="background-image:url('scenes/thumbs/${season}.jpg')"></div>`));
  pics.appendChild(picCard("rotate", "Rotate all", s.saverTheme === "rotate",
    `<div class="img mix">${THEMES.map(([t]) => `<div style="background-image:url('scenes/thumbs/${t}.jpg')"></div>`).join("")}</div>`));
  for (const [t, label] of THEMES) {
    pics.appendChild(picCard(t, label, s.saverTheme === t,
      `<div class="img" style="background-image:url('scenes/thumbs/${t}.jpg')"></div>`));
  }

  document.getElementById("preview").addEventListener("click", () => {
    browser.runtime.sendMessage({ type: "saver-preview" });
  });
})();
