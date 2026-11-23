// EAGLE-OS calendar links: reads iCal (.ics) calendars from Google, Outlook, iCloud, Yahoo and others,
// and turns them into a flat list of events (repeating events expanded) for the start page.
"use strict";

const EagleICal = (() => {
  // Outlook writes Windows time zone names; map the common ones.
  const WINDOWS_TZ = {
    "Eastern Standard Time": "America/New_York", "US Eastern Standard Time": "America/Indiana/Indianapolis",
    "Central Standard Time": "America/Chicago", "Mountain Standard Time": "America/Denver",
    "US Mountain Standard Time": "America/Phoenix", "Pacific Standard Time": "America/Los_Angeles",
    "Alaskan Standard Time": "America/Anchorage", "Hawaiian Standard Time": "Pacific/Honolulu",
    "Atlantic Standard Time": "America/Halifax", "GMT Standard Time": "Europe/London",
    "W. Europe Standard Time": "Europe/Berlin", "Romance Standard Time": "Europe/Paris",
    "Central Europe Standard Time": "Europe/Budapest", "UTC": "UTC", "Coordinated Universal Time": "UTC",
  };
  const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const DAY_MS = 86400000;

  function unescapeText(v) {
    return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
  }

  // ---- lines -> properties ----
  function parseLines(text) {
    const raw = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    const out = [];
    for (const line of raw) {
      if (!line) continue;
      // name;param=value;param="x:y":value  (colons inside quotes don't end the name part)
      let i = 0, q = false;
      for (; i < line.length; i++) {
        const c = line[i];
        if (c === '"') q = !q;
        else if (c === ":" && !q) break;
      }
      if (i >= line.length) continue;
      const head = line.slice(0, i), value = line.slice(i + 1);
      const parts = head.split(";");
      const params = {};
      for (const p of parts.slice(1)) {
        const eq = p.indexOf("=");
        if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
      }
      out.push({ name: parts[0].toUpperCase(), params, value });
    }
    return out;
  }

  // ---- dates and time zones ----
  function tzName(tzid) {
    if (!tzid) return null;
    let tz = WINDOWS_TZ[tzid] || tzid.replace(/^\/[^/]+\/[^/]+\//, ""); // strip "/mozilla.org/.../"
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch (e) { return null; }
  }
  const dtfCache = {};
  function tzOffset(tz, utcMs) {
    const f = dtfCache[tz] || (dtfCache[tz] = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const p = {};
    for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = +x.value;
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - utcMs;
  }
  // wall-clock fields -> real time (ms)
  function toMs(f, kind, tz) {
    if (kind === "date") return new Date(f.y, f.m, f.d).getTime();
    const guess = Date.UTC(f.y, f.m, f.d, f.h, f.mi, f.s);
    if (kind === "utc") return guess;
    if (tz) {
      const o1 = tzOffset(tz, guess - tzOffset(tz, guess));
      return guess - o1;
    }
    return new Date(f.y, f.m, f.d, f.h, f.mi, f.s).getTime(); // floating: this PC's time zone
  }
  function parseDate(prop) {
    const v = (prop.value || "").trim();
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v);
    if (!m) return null;
    const f = { y: +m[1], m: +m[2] - 1, d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
    const kind = !m[4] || prop.params.VALUE === "DATE" ? "date" : (m[7] ? "utc" : "local");
    const tz = kind === "local" ? tzName(prop.params.TZID) : null;
    return { f, kind, tz, ms: toMs(f, kind, tz) };
  }
  // wall-clock fields <-> a "floating" UTC number, for date arithmetic that ignores daylight saving
  const fl = (f) => Date.UTC(f.y, f.m, f.d, f.h, f.mi, f.s);
  function unfl(n) {
    const d = new Date(n);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }
  function parseDuration(v) {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v || "");
    if (!m) return null;
    const ms = ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 86400 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
    return m[1] === "-" ? -ms : ms;
  }

  // ---- repeating events ----
  function parseRule(v) {
    const r = {};
    for (const part of v.split(";")) { const [k, x] = part.split("="); if (k && x !== undefined) r[k.toUpperCase()] = x; }
    return r;
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  // nth weekday of a month (n>0 from the start, n<0 from the end); null if it doesn't exist
  function nthWeekday(y, m, dow, n) {
    if (n > 0) {
      const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
      const day = 1 + ((dow - firstDow + 7) % 7) + (n - 1) * 7;
      return day <= daysInMonth(y, m) ? day : null;
    }
    const last = daysInMonth(y, m), lastDow = new Date(Date.UTC(y, m, last)).getUTCDay();
    const day = last - ((lastDow - dow + 7) % 7) + (n + 1) * 7;
    return day >= 1 ? day : null;
  }
  function byDays(v) {
    return (v || "").split(",").filter(Boolean).map((x) => {
      const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x.trim().toUpperCase());
      return m && m[2] in DAYS ? { n: m[1] ? +m[1] : 0, dow: DAYS[m[2]] } : null;
    }).filter(Boolean);
  }

  // yields floating start values, in order, for a rule
  function* occurrences(start, rule) {
    const freq = (rule.FREQ || "").toUpperCase();
    const interval = Math.max(1, +(rule.INTERVAL || 1));
    const f0 = start.f, t0 = fl(f0), tod = t0 - Date.UTC(f0.y, f0.m, f0.d);
    const days = byDays(rule.BYDAY);
    const monthDays = (rule.BYMONTHDAY || "").split(",").filter(Boolean).map(Number);
    const months = (rule.BYMONTH || "").split(",").filter(Boolean).map((x) => +x - 1);
    const at = (y, m, d) => Date.UTC(y, m, d) + tod;
    const sorted = (a) => a.filter((x) => x !== null).sort((p, q) => p - q);
    for (let k = 0; k < 3000; k++) {
      let batch = [];
      if (freq === "DAILY") {
        const t = t0 + k * interval * DAY_MS;
        const dt = new Date(t);
        if ((!days.length || days.some((x) => x.dow === dt.getUTCDay())) &&
            (!months.length || months.includes(dt.getUTCMonth()))) batch = [t];
      } else if (freq === "WEEKLY") {
        const wkst = DAYS[(rule.WKST || "MO").toUpperCase()] ?? 1;
        const d0 = new Date(t0), back = (d0.getUTCDay() - wkst + 7) % 7;
        const weekStart = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() - back) + k * interval * 7 * DAY_MS;
        const want = days.length ? days.map((x) => x.dow) : [d0.getUTCDay()];
        batch = sorted(want.map((dow) => weekStart + ((dow - wkst + 7) % 7) * DAY_MS + tod));
      } else if (freq === "MONTHLY" || freq === "YEARLY") {
        const step = freq === "MONTHLY" ? interval : 12 * interval;
        const base = new Date(Date.UTC(f0.y, f0.m + k * step, 1));
        const y = base.getUTCFullYear();
        const ms = freq === "YEARLY" && months.length ? months : [freq === "YEARLY" ? f0.m : base.getUTCMonth()];
        for (const m of ms) {
          if (freq === "MONTHLY" && months.length && !months.includes(m)) continue;
          let ds = [];
          if (days.length) {
            for (const x of days) {
              if (x.n) ds.push(nthWeekday(y, m, x.dow, x.n));
              else for (let d = 1; d <= daysInMonth(y, m); d++) if (new Date(Date.UTC(y, m, d)).getUTCDay() === x.dow) ds.push(d);
            }
            if (rule.BYSETPOS) {
              const s = sorted(ds), pos = +rule.BYSETPOS;
              ds = [pos > 0 ? s[pos - 1] : s[s.length + pos]].filter((x) => x !== undefined);
            }
          } else if (monthDays.length) {
            ds = monthDays.map((d) => (d < 0 ? daysInMonth(y, m) + d + 1 : d)).filter((d) => d >= 1 && d <= daysInMonth(y, m));
          } else {
            ds = f0.d <= daysInMonth(y, m) ? [f0.d] : [];
          }
          batch.push(...ds.filter((d) => d !== null).map((d) => at(y, m, d)));
        }
        batch = sorted(batch);
      } else {
        yield t0; return;
      }
      for (const t of batch) if (t >= t0) yield t;
    }
  }

  // ---- whole calendar -> events between fromMs and toMs ----
  function parse(text, fromMs, toMs_) {
    const props = parseLines(text);
    const raw = [];
    let cur = null, depth = 0;
    for (const p of props) {
      if (p.name === "BEGIN") {
        if (p.value.toUpperCase() === "VEVENT") { cur = { exdates: [] }; depth = 0; } else if (cur) depth++;
        continue;
      }
      if (p.name === "END") {
        if (p.value.toUpperCase() === "VEVENT" && cur) { raw.push(cur); cur = null; } else if (cur) depth--;
        continue;
      }
      if (!cur || depth > 0) continue; // skip alarms inside events
      switch (p.name) {
        case "SUMMARY": cur.title = unescapeText(p.value); break;
        case "LOCATION": cur.location = unescapeText(p.value); break;
        case "UID": cur.uid = p.value; break;
        case "DTSTART": cur.start = parseDate(p); break;
        case "DTEND": cur.end = parseDate(p); break;
        case "DURATION": cur.duration = parseDuration(p.value); break;
        case "RRULE": cur.rule = parseRule(p.value); break;
        case "STATUS": cur.status = p.value.toUpperCase(); break;
        case "RECURRENCE-ID": cur.recurrenceId = parseDate(p); break;
        case "EXDATE":
          for (const v of p.value.split(",")) { const d = parseDate({ params: p.params, value: v }); if (d) cur.exdates.push(d.ms); }
          break;
        default: break;
      }
    }

    // instances replaced by their own edited copy
    const moved = new Set();
    for (const e of raw) if (e.recurrenceId && e.uid) moved.add(e.uid + "@" + e.recurrenceId.ms);

    const events = [];
    const add = (e, startMs, endMs) => {
      if (endMs <= fromMs || startMs >= toMs_) return;
      events.push({ title: e.title || "(no title)", location: e.location || "", start: startMs, end: endMs, allDay: e.start.kind === "date" });
    };
    for (const e of raw) {
      if (!e.start || e.status === "CANCELLED") continue;
      let len;
      if (e.end) len = e.end.ms - e.start.ms;
      else if (e.duration != null) len = e.duration;
      else len = e.start.kind === "date" ? DAY_MS : 0;
      if (len < 0) len = 0;
      if (!e.rule || e.recurrenceId) { add(e, e.start.ms, e.start.ms + len); continue; }

      const until = e.rule.UNTIL ? parseDate({ params: {}, value: e.rule.UNTIL }) : null;
      const count = e.rule.COUNT ? +e.rule.COUNT : Infinity;
      const ex = new Set(e.exdates);
      let n = 0;
      for (const t of occurrences(e.start, e.rule)) {
        const f = unfl(t);
        const s = toMs(f, e.start.kind, e.start.tz);
        if (until && s > until.ms + (until.kind === "date" ? DAY_MS - 1 : 0)) break;
        if (++n > count) break;
        if (s >= toMs_) break;
        if (ex.has(s) || (e.uid && moved.has(e.uid + "@" + s))) continue;
        // all-day and wall-clock lengths follow the calendar (daylight saving)
        const endMs = e.start.kind === "date" || e.start.tz || e.start.kind === "local"
          ? toMs(unfl(t + len), e.start.kind, e.start.tz) : s + len;
        add(e, s, endMs);
      }
    }
    events.sort((a, b) => a.start - b.start);
    return events;
  }

  function normalizeUrl(u) {
    u = (u || "").trim();
    if (/^webcals?:\/\//i.test(u)) u = "https://" + u.replace(/^webcals?:\/\//i, "");
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u;
  }

  return { parse, normalizeUrl };
})();

if (typeof module !== "undefined") module.exports = EagleICal;
