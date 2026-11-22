#!/bin/bash
# Builds out/eagle-os.iso. Run on Debian 13 (a spare PC, a VM, or Docker — see README),
# or let GitHub build it (see .github/workflows/build.yml).
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

cd "$(dirname "$0")"

apt-get update
apt-get install -y live-build

chmod +x auto/* config/hooks/live/*.hook.chroot config/includes.chroot/usr/local/bin/*

# The boot menu is branded by config/hooks/live/0900-eagle-bootmenu.hook.binary

lb clean
lb config
lb build

mkdir -p out
mv -f live-image-amd64.hybrid.iso out/eagle-os.iso

# Build report (published next to the ISO) to check the branding was applied
{
  echo "EAGLE-OS build $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "live-build: $(dpkg-query -W -f='${Version}' live-build)"
  echo; echo "== Boot menu files in the ISO =="
  find binary/boot binary/isolinux -type f \( -name '*.cfg' -o -name '*.png' -o -name 'theme.txt' \) 2>/dev/null | sort
  echo; echo "== Boot menu labels =="
  grep -rhoE '(menu label|menuentry) [^{]*' binary/boot binary/isolinux 2>/dev/null | sort -u
  echo; echo "== Menu colors =="
  grep -rhE 'menu color (sel|unsel)|item_color|menu_color|color_highlight' binary/boot binary/isolinux 2>/dev/null | sort -u
} > out/build-info.txt 2>&1 || true

echo "Done: $(pwd)/out/eagle-os.iso"
