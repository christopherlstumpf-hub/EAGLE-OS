// EAGLE-OS Lite: extra Firefox savings for slow processors (applied on top of low-memory settings).
user_pref("dom.ipc.processCount", 1);                       // one content process
user_pref("dom.ipc.processPrelaunch.enabled", false);
// Video: ask sites for H.264 (decoded by older graphics chips) instead of VP9/AV1 (CPU-heavy)
user_pref("media.mediasource.webm.enabled", false);
user_pref("media.av1.enabled", false);
user_pref("media.ffmpeg.vaapi.enabled", true);
// Less background work
user_pref("network.prefetch-next", false);
user_pref("network.dns.disablePrefetch", true);
user_pref("network.http.speculative-parallel-limit", 0);
user_pref("browser.urlbar.speculativeConnect.enabled", false);
user_pref("browser.places.speculativeConnect.enabled", false);
user_pref("browser.sessionhistory.max_total_viewers", 0);
user_pref("browser.sessionstore.max_tabs_undo", 3);
user_pref("browser.cache.disk.capacity", 102400);           // 100 MB disk cache
// Less animation
user_pref("general.smoothScroll", false);
user_pref("toolkit.cosmeticAnimations.enabled", false);
user_pref("ui.prefersReducedMotion", 1);
// Turn on the built-in ad blocker (uBlock Origin, installed system-wide) without asking
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.enabledScopes", 15);
