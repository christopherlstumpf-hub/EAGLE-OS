#!/bin/bash
# Builds EAGLE-OS. Run on Debian 13 (a spare PC, a VM, or Docker), or let GitHub build it.
#   ./build.sh            -> out/eagle-os.iso        (standard)
#   ./build.sh lite       -> out/eagle-os-lite.iso   (2-4 GB RAM, slow processors)
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

VARIANT="${1:-standard}"
case "$VARIANT" in
  standard) NAME="eagle-os" ;;
  lite)     NAME="eagle-os-lite" ;;
  *) echo "usage: $0 [standard|lite]" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="$ROOT/build/$VARIANT"

apt-get update
apt-get install -y live-build rsync zip

# Fresh working copy of the build config, with the variant's changes laid on top
rm -rf "$WORK"
mkdir -p "$WORK"
rsync -a --exclude build --exclude out --exclude .git --exclude config/variants "$ROOT"/ "$WORK"/
if [ "$VARIANT" != "standard" ]; then
  rsync -a "$ROOT/config/variants/$VARIANT"/ "$WORK/config"/
  sed -i -e 's/--iso-volume "EAGLE"/--iso-volume "EAGLE_LITE"/' \
         -e 's/--iso-application "EAGLE"/--iso-application "EAGLE-OS Lite"/' "$WORK/auto/config"
fi

cd "$WORK"

# EAGLE-OS add-on (start page, camera test, toolbar menu), with this edition's logo
ADDON="$WORK/build-addon"
rm -rf "$ADDON"; cp -a config/branding/eagle-menu "$ADDON"
cp config/includes.chroot/usr/share/eagle/logo.png "$ADDON/logo.png"
mkdir -p config/includes.chroot/usr/share/eagle
(cd "$ADDON" && rm -f ../eagle-menu.xpi && zip -q -r -X ../eagle-menu.xpi .)
mv -f "$WORK/eagle-menu.xpi" config/includes.chroot/usr/share/eagle/eagle-menu.xpi
rm -rf "$ADDON"

chmod +x auto/* config/hooks/live/*.hook.* config/includes.chroot/usr/local/bin/* config/includes.chroot/usr/local/sbin/*
# The boot menu is branded by config/hooks/live/0900-eagle-bootmenu.hook.binary

lb clean
lb config
lb build

mkdir -p "$ROOT/out"
mv -f live-image-amd64.hybrid.iso "$ROOT/out/$NAME.iso"

# Build report (published next to the ISO) to check the branding and variant
{
  echo "EAGLE-OS $VARIANT build $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "live-build: $(dpkg-query -W -f='${Version}' live-build)"
  echo "variant file: $(cat chroot/etc/eagle/variant 2>/dev/null || echo missing)"
  echo "zram: $(grep -E '^(ALGO|PERCENT)=' chroot/etc/default/zramswap 2>/dev/null | tr '\n' ' ')"
  # shellcheck disable=SC2016
  echo "ublock: $(chroot chroot dpkg-query -W -f='${Version}' webext-ublock-origin-firefox 2>/dev/null || echo not installed)"
  echo "ublock in Firefox: $(find chroot/usr/share/mozilla/extensions chroot/usr/lib/firefox-esr -maxdepth 3 -iname '*uBlock0*' 2>/dev/null | head -1)"
  echo "installer packages: $(find chroot/usr/share/eagle/debs -name '*.deb' -printf '%f ' 2>/dev/null)"
  echo "toolbar add-on: $(ls chroot/usr/share/eagle/eagle-menu.xpi 2>/dev/null || echo missing)"
  echo; echo "== Mac drivers =="; cat chroot/usr/share/eagle/mac-drivers.txt 2>/dev/null || echo "missing"
  echo "unsquashfs: $(ls chroot/usr/bin/unsquashfs 2>/dev/null || echo missing)"
  echo; echo "== Boot menu labels =="
  grep -rhoE '(menu label|menuentry) [^{]*' binary/boot binary/isolinux 2>/dev/null | sort -u
} > "$ROOT/out/$NAME-build-info.txt" 2>&1 || true

echo "Done: $ROOT/out/$NAME.iso"
