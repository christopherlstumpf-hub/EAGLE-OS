// EAGLE-OS Firefox settings, applied on every start.
user_pref("xpinstall.signatures.required", false);       // allow the built-in EAGLE theme
user_pref("extensions.activeThemeID", "theme@eagle-os");
user_pref("browser.startup.homepage", "file:///usr/share/eagle/start.html");
user_pref("browser.newtabpage.enabled", false);           // new tabs open blank (black)
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("layout.css.prefers-color-scheme.content-override", 0); // dark mode for websites that support it
user_pref("ui.systemUsesDarkTheme", 1);
user_pref("widget.content.allow-gtk-dark-theme", true);
