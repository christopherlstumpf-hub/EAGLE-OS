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
   - **Advanced: Debian installer**: the standard Debian installer, as a fallback.
5. Turn off **Secure Boot** in the BIOS if the stick won't start.

## Installing (wipes a drive)
You can start the EAGLE installer three ways: from the boot menu, with the orange **Install EAGLE-OS** button on the start page (shown while running from the stick), or from the orange **E** toolbar button.

1. Pick the drive. It lists each one's size, type (SSD, hard drive, USB drive, SD card) and model, and never the stick you started from.
2. Check what's on it now (for example Windows), then type **ERASE** to confirm.
3. EAGLE-OS wipes the drive, partitions it for your PC (UEFI or older BIOS), copies itself and sets up the bootloader. Your Wi-Fi networks and display settings carry over.
4. Remove the stick when asked. The PC restarts into EAGLE-OS.

To carry EAGLE-OS with you, install it onto a second USB stick or microSD card.

## First start
1. The EAGLE-OS splash appears: chrome letters on black with an orange progress bar.
2. **Setup** opens: Wi-Fi, Display (resolution and text size), Sound.
3. Choose **Start browsing** and Firefox opens on the EAGLE start page.

After that, EAGLE-OS goes straight to Firefox on every start.

## The EAGLE menu
Click the orange **E** button in Firefox's toolbar, or close Firefox, to open the EAGLE menu:
- **Start browsing**
- **Wi-Fi and network**
- **Display and screen size**: resolution and text/button size
- **Sound**: volume, mute, choose speakers, headphones or HDMI, test sound
- **Camera test**: live preview and a microphone level meter
- **Updates**: check for updates, install them now, or turn automatic updates on or off
- **Install EAGLE-OS on this PC**: shown while running from the stick or card
- **Restart** / **Shut down**

The power button also shuts the PC down.

## Updates
EAGLE-OS runs on Debian 13. By default it installs Debian's security and regular updates automatically in the background when it's online. You can also update on demand from **Updates** in the EAGLE menu.

If you're running straight from the stick or card (Run EAGLE-OS), updates are lost at restart. Install EAGLE-OS to keep it updated.

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
