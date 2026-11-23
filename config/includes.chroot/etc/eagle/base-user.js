// EAGLE-OS Firefox settings, applied on every start.
user_pref("xpinstall.signatures.required", false);       // allow the built-in EAGLE theme
user_pref("extensions.activeThemeID", "theme@eagle-os");
user_pref("browser.startup.homepage", "moz-extension://6f1c2e8a-3b7d-4e59-9a0b-5e61a9e00001/start.html");
// Fixed internal address for the EAGLE add-on, so its start page has a known URL
user_pref("extensions.webextensions.uuids", "{\"menu@eagle-os\":\"6f1c2e8a-3b7d-4e59-9a0b-5e61a9e00001\",\"theme@eagle-os\":\"6f1c2e8a-3b7d-4e59-9a0b-5e61a9e00002\"}");
// No first-run privacy/data notices or tabs
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("trailhead.firstrun.didSeeAboutWelcome", true);
user_pref("browser.newtabpage.enabled", false);           // new tabs open blank (black)
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("layout.css.prefers-color-scheme.content-override", 0); // dark mode for websites that support it
user_pref("ui.systemUsesDarkTheme", 1);
user_pref("widget.content.allow-gtk-dark-theme", true);
// Allow the EAGLE-OS toolbar style (larger orange E button)
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
// Spotify, Netflix and other protected music/video: Firefox fetches Google's Widevine module once online
user_pref("media.eme.enabled", true);
user_pref("media.gmp-widevinecdm.enabled", true);
user_pref("media.gmp-widevinecdm.visible", true);
user_pref("media.gmp-manager.updateEnabled", true);
