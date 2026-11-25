# EAGLE-OS
*by Stumpf Technology*

An operating system that is only a web browser. It runs or installs from a USB stick or microSD card. It boots to a black screen with chrome EAGLE-OS lettering, sets up Wi-Fi, display and sound, then opens Firefox. The look is black, grey and orange throughout.

Built on Debian 13 (trixie) for 64-bit Intel/AMD PCs, including older ones.

## Minimum PC
- A 64-bit Intel or AMD processor. Most PCs from about 2008 onward qualify, but 32-bit-only machines are not supported.
- 2 GB RAM (4 GB or more is smoother)
- To install: an 8 GB drive or larger. This can be an internal drive, a USB stick or a microSD card.
- Old BIOS or newer UEFI firmware both work

On PCs with 4 GB of RAM or less, the standard edition automatically switches Firefox to low-memory settings and adds compressed RAM swap. Old graphics chips that aren't supported fall back to software drawing.

## Two editions
| | **EAGLE-OS** (`eagle-os.iso`) | **EAGLE-OS Lite** (`eagle-os-lite.iso`) |
|---|---|---|
| Best for | 4 GB+ RAM, any 64-bit PC | 2–4 GB RAM, slow processors (Atom, Celeron, Pentium, Core 2 Duo, AMD E-series) |
| Firefox | Full speed; auto low-memory mode at 4 GB or less | Always low-memory and slow-CPU mode: one content process, no animations, less background loading |
| Video | Sites' default formats | Asks sites like YouTube for H.264, which older graphics chips decode in hardware instead of tying up the processor |
| Ad and tracker blocking | — | Built in (uBlock Origin): the biggest speed-up on slow PCs |
| Compressed RAM swap | 60%, zstd | 75%, lz4 (fastest on slow processors) |

Both editions have the same setup, EAGLE menu, sound and updates. Lite shows **LITE** under the logo.

## Get started
1. Download `eagle-os.iso` (or `eagle-os-lite.iso` for low-end PCs) from this repo's **Releases** page.
2. Flash it to a USB stick or microSD card (8 GB or larger) with [balenaEtcher](https://etcher.balena.io).
3. Plug it into the PC and power on. Tap **F12** (or F11, F9, Esc) to choose the stick or card.
   - Many PCs can boot from USB. Fewer can boot from a microSD slot; if yours can't, use a USB card reader.
4. Pick from the boot menu:
   - **Run EAGLE-OS**: runs straight from the stick or card without touching the PC. Nothing is saved after shutdown.
   - **Install EAGLE-OS (wipes a drive)**: opens the EAGLE installer right away (see below).
   - **Run EAGLE-OS (safe graphics)**: use this if you get a black screen with a blinking cursor. It's for graphics chips that won't start normally.
   - **Advanced: Debian installer**: the standard Debian installer, as a fallback.
5. Turn off **Secure Boot** in the BIOS if the stick won't start.
6. The first start from a USB stick can take 1–3 minutes, longer on old USB 2.0 ports. If the display can't start with your graphics chip, EAGLE-OS switches to software drawing by itself and remembers that.

## Acer Aspire One Cloudbook 14 (AO1-431) and similar Acer laptops
These start EAGLE-OS reliably only in **UEFI** mode. Set the firmware up once before booting the stick:
1. Power on and tap **F2** at the Acer logo to open the BIOS setup.
2. **Main**: set **F12 Boot Menu** to **Enabled**.
3. **Security**: choose **Set Supervisor Password** and pick one you'll remember. Acer requires one before Secure Boot can be changed.
4. **Boot**: set **Boot Mode** to **UEFI** and **Secure Boot** to **Disabled**.
5. Press **F10** to save. Then restart, tap **F12** and choose the USB stick.

Use **EAGLE-OS Lite** on 2 GB models. The installer puts EAGLE-OS on the built-in 32 GB eMMC, which shows as an "SD card" type drive named `mmcblk0`.

If the laptop won't start EAGLE-OS after installing: in the BIOS setup, go to **Security**, choose **Select an UEFI file as trusted for executing**, and pick `EFI/BOOT/BOOTX64.EFI` on the eMMC. Save with **F10**.

If you do start in Legacy mode, EAGLE-OS adds the startup fixes those laptops need. If the screen still stays black, choose **Run EAGLE-OS (safe graphics)**.

## Mac (Intel MacBook Air / MacBook Pro, about 2010–2017)

1. Plug in the EAGLE stick, turn the Mac on and **hold the Option (⌥) key** until the startup disks appear.
2. Pick **EFI Boot**. Use the standard edition on Macs with 4 GB or more.
3. Wi-Fi uses the Broadcom "wl" driver built into EAGLE; it shows up in the Wi-Fi screen as usual.
4. The FaceTime HD camera needs Apple's camera firmware, which can't be shipped on the stick. Once the Mac is online, EAGLE downloads it from Apple (about 18 MB) and the camera turns on a minute or two later. When running from the stick this happens on every start.
5. The volume keys (F10–F12) and the brightness keys (F1/F2) work.

**Installing on a Mac erases macOS** if you pick the Mac's internal drive. On an installed Mac, the first time it's online EAGLE sets up automatic rebuilding of the Wi-Fi and camera drivers (about 300 MB, a few minutes in the background). After that the Mac gets the same Debian security updates as a PC. If a driver ever fails to rebuild for a new Linux version, the Mac keeps starting the previous one so Wi-Fi never disappears. Not yet tested on a real Mac; Macs with the T2 security chip (2018 and later) and Apple-silicon Macs are not supported.

## Installing (wipes a drive)
You can start the EAGLE installer three ways: from the boot menu, with the orange **Install EAGLE-OS** button on the start page (shown while running from the stick), or from the orange **E** toolbar button.

1. Pick the drive. It lists each one's size, type (SSD, hard drive, USB drive, SD card) and model, and never the stick you started from.
2. Check what's on it now (for example Windows), then type **ERASE** to confirm.
3. EAGLE-OS wipes the drive, partitions it for your PC (UEFI or older BIOS), copies itself and sets up the bootloader. Your Wi-Fi networks and display settings carry over.
4. Remove the stick when asked. The PC restarts into EAGLE-OS.

To carry EAGLE-OS with you, install it onto a second USB stick or microSD card.

## First start
1. The EAGLE-OS splash appears: chrome letters on black with an orange progress bar. The EAGLE startup chime plays as the session comes up; you can turn it off under Sound.
2. **Setup** opens: Wi-Fi, Display (resolution and text size), Sound.
3. Choose **Start browsing** and Firefox opens on the EAGLE start page.

After that, EAGLE-OS goes straight to Firefox on every start.

## The EAGLE menu
Click the orange **E** button in Firefox's toolbar, or close Firefox, to open the EAGLE menu:
- **Start browsing**
- **Wi-Fi and network**
- **Display and screen size**: resolution and text/button size
- **Date and time**: automatic time from the internet (on by default), time zone (US zones listed first, then any city), or set the date and time by hand
- **Sound**: volume, mute, choose speakers, headphones or HDMI, test sound, startup sound on/off
- **Camera test**: live preview and a microphone level meter
- **Security (antivirus)**: scan Downloads, all your files or the whole system, update virus definitions, manage quarantine
- **Disks and partitions (GParted)**: view, resize, format or wipe drives and partitions, including Windows (NTFS) and exFAT drives
- **Updates**: check for updates, install them now, or turn automatic updates on or off
- **Install EAGLE-OS on this PC**: shown while running from the stick or card
- **Restart** / **Shut down**

The power button also shuts the PC down.

## Updates

A fresh EAGLE-OS build is published every Monday with Debian's latest security fixes. When running from a stick, updates don't stick between restarts, so write the newest release to your stick now and then. Installed PCs and Macs update themselves daily.
EAGLE-OS runs on Debian 13. By default it installs Debian's security and regular updates automatically in the background when it's online. You can also update on demand from **Updates** in the EAGLE menu.

If you're running straight from the stick or card (Run EAGLE-OS), updates are lost at restart. Install EAGLE-OS to keep it updated.

## Start page (the EAGLE tab)

The **EAGLE tab** is always the first tab: pinned, it can't be closed or moved (if it's closed anyway it comes straight back), and anything typed into it opens in a new tab. It has no buttons, just:
- an **analog clock** with the date and time, and under it a small **Wi-Fi meter** (signal bars, network name and signal %, or "No internet", "Sign-in needed", "Not connected"; click it for the Wi-Fi screen) and the **battery** (laptops);
- **Notifications**: new Gmail email (when signed in to Gmail in the browser), unread counts that sites show in their tabs (like "(3) Facebook"), calendar events starting within the hour, antivirus finds, installed updates, low battery and **Install EAGLE-OS** when running from the stick. **Website pop-ups go here too, never on top of the screen**: Facebook and Messenger messages, Gmail, Google Calendar reminders and any other site's notifications, plus a box ("alert") that a tab you're not looking at tries to show. The EAGLE tab shows a dot and the count ("(2) EAGLE-OS") when something new arrives. Click one to open that site's tab (a message opens that chat), ✕ to dismiss, or **Clear all**. Sites are allowed to send notifications without asking. Only the last-chance 5% battery warning also appears over the page;
- the **month calendar** on the right, with today's events and what's coming up.
"by Stumpf Technology" is at the bottom and the version (for example *EAGLE-OS · Build 48*) in the lower right corner. The default time zone is US Eastern; change it under **Date and time**.

**Link tabs:** the sites sit right after the EAGLE tab as small locked tabs showing just their icon, in A–Z order: Google, Gmail, YouTube, Maps, News and Weather always, plus your own: to start Spotify, Facebook and Google's Calendar, Docs, Drive, Meet and Photos, which share your one Google sign-in so they open straight to your account (remove any in E menu → Link tabs). Like the EAGLE tab, they can't be closed, unpinned or moved (closed anyway, they come straight back in their place), and any new tab opens to their right. Each loads its site only when you click its tab. Add or remove your own in the orange E menu → **Link tabs**. When the screen timeout returns to the EAGLE tab, the other tabs close and the link tabs go back to their sites' start.

## MacBook function keys

F1/F2 screen brightness · F3 (Mission Control) shows the EAGLE tab · F4 (Launchpad) opens the EAGLE menu screen · F5/F6 keyboard backlight · F7/F8/F9 previous / play-pause / next for music and video in the browser · F10 mute · F11/F12 volume.

## Colour scheme

Orange E button → **Colour scheme**. EAGLE Orange is the original and the default; the other eight colours come from the Mountains screensaver pictures (Sunset Gold, Sunset Ember, Dawn Glow, Alpenglow, Alpine Sky, Mountain Lake, Twilight Peaks, Pine Forest). The choice recolours the Firefox toolbar highlights, the E button, the logo's accents, the start page and the EAGLE pages; black and grey stay. The boot screens and setup screens keep the original orange.

## Google Chrome (standard edition)

Orange E menu → **Web browser** → **Install Google Chrome**. EAGLE downloads Chrome from Google (about 150 MB; Google's terms don't allow it on the stick itself), installs it, and asks whether to open EAGLE in Chrome. Chrome then updates itself with the daily updates. The EAGLE start page, E button, calendar, battery, screensaver, colour scheme and settings screens all work in Chrome too, and your links, calendars and colours are shared between Firefox and Chrome. Switch back to Firefox or remove Chrome on the same screen. EAGLE-OS Lite stays on Firefox to save memory.

## Tools

Orange E menu → **Tools**:
- **Internet speed test**: download, upload, ping and jitter for the current Wi-Fi or network, with your internet provider and a plain-English verdict (uses Cloudflare's speed test servers; one test uses about 100–300 MB).
- **Camera test**, **Printers**, **Disks and partitions** (GParted) and **Virus scan**.

## Printers

Most Wi-Fi and network printers (AirPrint, IPP Everywhere, Mopria; nearly every printer made since about 2013) show up by themselves when you print from Firefox (**Ctrl+P** or ☰ → Print). To add one for good, open the orange E menu → **Printers**:
- **Find printers** lists printers on the network and USB; pick one to add it (the first one becomes the default).
- **Add a network printer by IP address** for printers that don't show up (the address is on the printer's network settings).
- **Print a test page** (an EAGLE-OS page with colour bars and text sizes; EAGLE waits for the printer and says whether it printed or what went wrong), **Choose the default printer**, **Remove a printer**.
- **HP printers**: newer HP printers print driverless; older HP network and USB printers use HP's own HPLIP connection and drivers, which EAGLE picks automatically.
Older USB printers use the HP (hpcups) or Gutenprint drivers when they aren't driverless. Running from the stick, printers are forgotten at restart; **Install** keeps them.

## Battery

On laptops the battery level shows under the clock on the start page (with time left, or "Charging" / "Plugged in"), at the top of the EAGLE menu, and as a small number on the orange E button (green with ⚡ when charging, red at 20% or less). Warnings appear at 20%, 10% and 5%; at 3% EAGLE-OS shuts down cleanly so nothing is lost. Desktops without a battery show nothing.

## Calendar links (Google, Outlook, iCloud)

The month calendar on the start page can show your own calendars.

**Google Calendar takes one click:** click **+ Connect Google Calendar** under the calendar (or the "Show your Google Calendar here?" notification that appears once you've signed in to Google). EAGLE opens your Google Calendar settings, goes to your calendar, outlines *Secret address in iCal format* in orange and tells you what to click. Press the copy button (or the eye) and EAGLE picks the address up, checks it and adds the calendar by itself. Then **Back to the EAGLE tab** closes Google's page. Nothing to find or paste.

**Outlook, iCloud and others:** click **Calendars** under the calendar and paste the calendar's private iCal link (Outlook: Settings → Calendar → Shared calendars → Publish → ICS; iCloud: share the calendar as a Public Calendar), pick a colour and add it.

Days with events get coloured dots; click a day to see its events, with "Coming up" below. Up to 8 calendars, refreshed every 15 minutes. View only: add or change events in Google, Outlook or iCloud. The links are kept on this PC only.

## Spotify and streaming

The start page has a Spotify tile (open.spotify.com; remove it in Edit links if you like). Spotify, Netflix and other protected music and video need Google's Widevine module, which Firefox downloads by itself the first time it's online (a few seconds; on a stick, after each restart). Sign in with your Spotify account (free or Premium).

## Screen timeout and screensaver
Open **Screen timeout and screensaver** from the orange E button.
- **Return to the EAGLE start page** after Off / 5 / 10 / 30 / 60 minutes with no activity. Other tabs close, which suits shared PCs.
- **Screensaver** after Off / 1 / 5 / 10 / 30 / 60 minutes (10 by default). It's a full-screen slideshow with the time and date. Moving the mouse or pressing any key returns to where you were.
- **Pictures:** Current season (the default, changes through the year), Rotate all, Beach, Mountains, Winter, Summer, Fall or Spring. Each theme has three original EAGLE-OS paintings, regenerated by `config/branding/make_scenes.py`.
- A tab playing video or music counts as activity, so neither kicks in while you're watching.
- The slideshow adds a slow zoom on the standard edition; Lite uses plain cross-fades to save the processor.

## Antivirus
EAGLE-OS includes ClamAV, the standard open-source antivirus.
- **Virus definitions** update automatically on installed PCs.
- **Real-time protection** checks every file saved to Downloads, on installed PCs with 4 GB of RAM or more. It's off on smaller PCs because ClamAV keeps about 1 GB of definitions in memory while watching.
- **Scheduled scans** of Downloads run daily (weekly on EAGLE-OS Lite), at idle priority so browsing isn't slowed.
- **On demand:** open **Security** from the orange E button to scan Downloads, all your files or the whole system.
- **Quarantine:** infected files are moved to a locked folder where they can't be opened, and can be deleted from there.

Running from the USB stick, scans still work, but the definitions (about 250 MB) download into memory each time.

## Volume keys
On a laptop's built-in keyboard, **F9** lowers the volume and **F10** raises it, in Firefox, the EAGLE menus and the screensaver, with a soft tick at the new level. Hold the key to keep changing. The laptop's mute key toggles mute. A plugged-in USB keyboard keeps normal F9/F10 (its own volume keys still work).

## Camera
USB webcams and most built-in laptop cameras (UVC) work in Firefox for video calls; sites ask before using it. Use **Camera test** to check it. Some very new laptops with Intel "IPU6" MIPI cameras aren't supported yet.

## Sound
The standard sound drivers built into Linux cover most PCs: HD Audio, USB headsets and HDMI. Firmware for newer Intel laptop sound chips is also included.

## Build it yourself (optional)
Every push to `main` builds both editions on GitHub and posts them under **Releases**, each with a build report. On Debian 13: `sudo ./build.sh` (standard) or `sudo ./build.sh lite`. Lite's differences live in `config/variants/lite/`.

## Settings for builders
- `config/includes.chroot/etc/eagle/eagle.conf`: the start page, and `KIOSK=1` for a single locked site
- `config/branding/`: the splash and logo art. `make_logo.py` regenerates it.
- `config/includes.chroot/usr/share/eagle/start.html`: the EAGLE start page

## Prototype limits
- There's no admin login by design. To fix or change a machine, reinstall it.
