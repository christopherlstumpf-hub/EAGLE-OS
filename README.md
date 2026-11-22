# EAGLE-OS

An operating system that is only a web browser. It runs or installs from a USB stick or microSD card. It boots to a black screen with chrome EAGLE-OS lettering, sets up Wi-Fi, display and sound, then opens Firefox. The look is black, grey and orange throughout.

Built on Debian 13 (trixie) for 64-bit Intel/AMD PCs, including older ones.

## Minimum PC
- A 64-bit Intel or AMD processor. Most PCs from about 2008 onward qualify, but 32-bit-only machines are not supported.
- 2 GB RAM (4 GB or more is smoother)
- To install: an 8 GB drive or larger. This can be an internal drive, a USB stick or a microSD card.
- Old BIOS or newer UEFI firmware both work

On PCs with 4 GB of RAM or less, EAGLE-OS automatically switches Firefox to low-memory settings and adds compressed RAM swap. Old graphics chips that aren't supported fall back to software drawing.

## Get started
1. Download `eagle-os.iso` from this repo's **Releases** page.
2. Flash it to a USB stick or microSD card (8 GB or larger) with [balenaEtcher](https://etcher.balena.io).
3. Plug it into the PC and power on. Tap **F12** (or F11, F9, Esc) to choose the stick or card.
   - Many PCs can boot from USB. Fewer can boot from a microSD slot; if yours can't, use a USB card reader.
4. Pick one:
   - **Run EAGLE-OS**: runs straight from the stick or card without touching the PC. Nothing is saved after shutdown.
   - **Install EAGLE-OS (erases a drive)**: you pick the drive, and the rest is automatic. To carry EAGLE-OS with you, with your Wi-Fi and settings saved, install it onto a second USB stick or microSD card.
5. Turn off **Secure Boot** in the BIOS if the stick won't start.

## First start
1. The EAGLE-OS splash appears: chrome letters on black with an orange progress bar.
2. **Setup** opens: Wi-Fi, Display (resolution and text size), Sound.
3. Choose **Start browsing** and Firefox opens on the EAGLE start page.

After that, EAGLE-OS goes straight to Firefox on every start.

## The EAGLE menu
Close Firefox at any time to open the EAGLE menu:
- **Start browsing**
- **Wi-Fi and network**
- **Display and screen size**: resolution and text/button size
- **Sound**: volume, mute, choose speakers, headphones or HDMI, test sound
- **Updates**: check for updates, install them now, or turn automatic updates on or off
- **Restart** / **Shut down**

The power button also shuts the PC down.

## Updates
EAGLE-OS runs on Debian 13. By default it installs Debian's security and regular updates automatically in the background when it's online. You can also update on demand from **Updates** in the EAGLE menu.

If you're running straight from the stick or card (Run EAGLE-OS), updates are lost at restart. Install EAGLE-OS to keep it updated.

## Sound
The standard sound drivers built into Linux cover most PCs: HD Audio, USB headsets and HDMI. Firmware for newer Intel laptop sound chips is also included.

## Build it yourself (optional)
Every push to `main` builds a fresh ISO on GitHub and posts it under **Releases** with a `build-info.txt` report. You can also build it on Debian 13 with `sudo ./build.sh`, which writes `out/eagle-os.iso`.

## Settings for builders
- `config/includes.chroot/etc/eagle/eagle.conf`: the start page, and `KIOSK=1` for a single locked site
- `config/branding/`: the splash and logo art. `make_logo.py` regenerates it.
- `config/includes.chroot/usr/share/eagle/start.html`: the EAGLE start page

## Prototype limits
- There's no admin login by design. To fix or change a machine, reinstall it.
