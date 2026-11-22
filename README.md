# EAGLE

A PC operating system that is only a web browser. It boots straight into Firefox full screen, with nothing else to learn.

## Minimum PC
- A 64-bit Intel or AMD processor. Most PCs from about 2008 onward qualify, but 32-bit-only machines are not supported.
- 2 GB RAM (4 GB or more is smoother)
- 8 GB drive or larger
- Old BIOS or newer UEFI firmware both work

On PCs with 4 GB of RAM or less, EAGLE automatically switches Firefox to low-memory settings and adds compressed RAM swap. Old graphics chips that aren't supported fall back to software drawing.

## Install it on a PC (about 10 minutes)
1. Download `eagle-os.iso` from this repo's **Releases** page.
2. Flash it to a USB stick (8 GB or larger) with [balenaEtcher](https://etcher.balena.io).
3. Plug the stick into the PC and power on. Tap **F12** (or F11, F9, Esc) to pick the USB stick.
4. Choose **Install**, then pick the drive to use. **That drive is erased.**
5. Remove the stick when it reboots. Firefox opens. Connect to Wi-Fi if asked.

Choose **Live** instead of Install to try it without touching the PC.

If the PC won't boot from the stick, turn off **Secure Boot** in the BIOS setup.

## Using it
- Firefox is the whole screen. If it's closed or crashes, it reopens.
- Press the power button to shut down.
- It installs security updates on its own when it's online.

## Build the installer yourself (optional)
**Easiest: in the cloud.** Push this folder to a GitHub repo. In the **Actions** tab, run **Build USB installer**. In about 30–60 minutes the ISO appears under **Releases**.

**On a Debian 13 PC or VM:** `sudo ./build.sh`, which writes `out/eagle-os.iso`.

## Settings
Change these in `config/includes.chroot/etc/eagle/eagle.conf` before building:
- `HOME_URL`: the start page
- `KIOSK=1`: one locked site, with no tabs or address bar

## Prototype limits
- There's no on-screen Wi-Fi or shutdown menu yet.
- There's no admin login by design. To fix or change a machine, reinstall it.
