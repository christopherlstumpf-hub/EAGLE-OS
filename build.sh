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

# ---- EAGLE-OS boot menu: black chrome splash, orange highlight, Run / Install labels ----
brand_bootloaders() {
  local src=/usr/share/live/build/bootloaders f b64
  mkdir -p config/bootloaders
  for bl in isolinux grub-pc; do
    [ -d "$src/$bl" ] || continue
    rm -rf "config/bootloaders/$bl"
    cp -a "$src/$bl" config/bootloaders/   # keep links; live-build resolves them
  done

  # Splash pictures
  while IFS= read -r f; do
    case "$f" in
      */isolinux/*) cp config/branding/splash-640x480.png "$f" ;;
      *)            cp config/branding/splash-1920x1080.png "$f" ;;
    esac
  done < <(find config/bootloaders -name 'splash.png' -type f)

  b64=$(base64 -w0 config/branding/splash-640x480.png)
  while IFS= read -r f; do
    printf '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="640" height="480"><image width="640" height="480" xlink:href="data:image/png;base64,%s"/></svg>\n' "$b64" > "$f"
  done < <(find config/bootloaders -name 'splash.svg*')

  # Menu labels and colors (each edit is a no-op if the template differs)
  find config/bootloaders -type f \( -name '*.cfg' -o -name '*.in' \) -print0 | xargs -0 -r sed -i -E \
    -e 's/Live system \(@FLAVOUR@\)/Run EAGLE-OS/g' \
    -e 's/Live system/Run EAGLE-OS/g' \
    -e 's/(menu label \^?)Install$/\1Install EAGLE-OS (erases a drive)/' \
    -e 's/menuentry "Install"/menuentry "Install EAGLE-OS (erases a drive)"/' \
    -e 's/Graphical install/Install EAGLE-OS (graphical)/' \
    -e 's/^(menu color (sel|hotsel)[[:space:]]+[^[:space:]]+[[:space:]]+)[^[:space:]]+[[:space:]]+[^[:space:]]+/\1#ff000000 #ffff7a00/' \
    -e 's/^(menu color (unsel|title|tabmsg|timeout_msg|help)[[:space:]]+[^[:space:]]+[[:space:]]+)[^[:space:]]+/\1#ffd6d6d6/' \
    -e 's/^([[:space:]]*selected_item_color[[:space:]]*[=:][[:space:]]*).*/\1"#ff7a00"/' \
    -e 's/^([[:space:]]*item_color[[:space:]]*[=:][[:space:]]*).*/\1"#d6d6d6"/' \
    -e 's/^(set menu_color_highlight=).*/\1black\/brown/' \
    -e 's/^(set menu_color_normal=).*/\1light-gray\/black/'
}
brand_bootloaders
echo "== EAGLE boot menu templates =="; find config/bootloaders \( -type f -o -type l \) | sort

lb clean
lb config
lb build

mkdir -p out
mv -f live-image-amd64.hybrid.iso out/eagle-os.iso

# Build report (published next to the ISO) to check the branding was applied
{
  echo "EAGLE-OS build $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "live-build: $(dpkg-query -W -f='${Version}' live-build)"
  echo; echo "== Boot menu files =="
  find config/bootloaders -type f | sort
  echo; echo "== Boot menu labels =="
  grep -rhoE '(menu label|menuentry) [^{]*' config/bootloaders | sort -u
  echo; echo "== Menu colors =="
  grep -rhE 'menu color (sel|unsel)|item_color|menu_color' config/bootloaders | sort -u
} > out/build-info.txt 2>&1 || true

echo "Done: $(pwd)/out/eagle-os.iso"
