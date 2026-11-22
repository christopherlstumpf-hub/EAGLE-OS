// Firefox settings applied automatically on PCs with 4 GB of RAM or less.
user_pref("fission.autostart", false);            // fewer processes
user_pref("dom.ipc.processCount", 2);             // cap content processes
user_pref("browser.tabs.unloadOnLowMemory", true);// park idle tabs when RAM is tight
user_pref("browser.cache.memory.capacity", 32768);// 32 MB memory cache
user_pref("browser.sessionstore.interval", 60000);// write session less often
user_pref("extensions.pocket.enabled", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
