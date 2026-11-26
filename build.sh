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
apt-get install -y live-build rsync zip python3-cryptography

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

# Version shown on the start page (lower right) and in the EAGLE menu: "build 38" from GitHub, "dev" otherwise
mkdir -p config/includes.chroot/etc/eagle
EAGLE_VERSION=$(printf "%s" "${EAGLE_VERSION:-dev}" | sed "s/^build-/build /")   # tag "build-61" shows as "build 61"
printf 'VERSION="%s"\nDATE="%s"\n' "$EAGLE_VERSION" "$(date -u +%Y-%m-%d)" > config/includes.chroot/etc/eagle/version

# EAGLE-OS add-on (start page, camera test, toolbar menu), with this edition's logo
ADDON="$WORK/build-addon"
rm -rf "$ADDON"; cp -a config/branding/eagle-menu "$ADDON"
# start page: logo without the byline ("by Stumpf Technology" sits at the bottom of the page instead)
if [ "$VARIANT" = standard ] && [ -f config/includes.chroot/usr/share/eagle/logo-plain.png ]; then
  cp config/includes.chroot/usr/share/eagle/logo-plain.png "$ADDON/logo.png"
else
  cp config/includes.chroot/usr/share/eagle/logo.png "$ADDON/logo.png"
fi
mkdir -p config/includes.chroot/usr/share/eagle
(cd "$ADDON" && rm -f ../eagle-menu.xpi && zip -q -r -X ../eagle-menu.xpi .)
mv -f "$WORK/eagle-menu.xpi" config/includes.chroot/usr/share/eagle/eagle-menu.xpi
# Google Chrome version of the add-on (standard edition): signed CRX served to Chrome from this PC
# (eagle-chrome-addon.service), plus Chrome's policies and native messaging host for its ID.
if [ "$VARIANT" = standard ]; then
  CHDIR=config/includes.chroot/usr/share/eagle/chrome
  BUILDNO=$(printf '%s' "${EAGLE_VERSION:-}" | grep -o '[0-9]\+' | tail -1)
  CHROME_ID=$(python3 config/branding/make_chrome_ext.py "$ADDON" "$CHDIR" "2.0.${BUILDNO:-0}")
  mkdir -p config/includes.chroot/etc/opt/chrome/policies/managed config/includes.chroot/etc/opt/chrome/native-messaging-hosts
  cat > config/includes.chroot/etc/opt/chrome/policies/managed/eagle.json <<JSON
{
  "ExtensionSettings": {
    "$CHROME_ID": { "installation_mode": "force_installed", "update_url": "http://127.0.0.1:8743/update.xml", "toolbar_pin": "force_pinned" }
  },
  "HomepageLocation": "chrome-extension://$CHROME_ID/start.html",
  "HomepageIsNewTabPage": false,
  "ShowHomeButton": true,
  "RestoreOnStartup": 4,
  "RestoreOnStartupURLs": ["chrome-extension://$CHROME_ID/start.html"],
  "DefaultBrowserSettingEnabled": false,
  "DefaultNotificationsSetting": 1,
  "MetricsReportingEnabled": false,
  "PromotionalTabsEnabled": false,
  "BackgroundModeEnabled": false,
  "PrivacySandboxPromptEnabled": false,
  "SuppressUnsupportedOSWarning": true,
  "HardwareAccelerationModeEnabled": true
}
JSON
  cat > config/includes.chroot/etc/opt/chrome/native-messaging-hosts/eagle.json <<JSON
{
  "name": "eagle",
  "description": "EAGLE-OS system actions",
  "path": "/usr/local/lib/eagle/eagle-native",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$CHROME_ID/"]
}
JSON
  echo "Chrome add-on: $CHROME_ID (2.0.${BUILDNO:-0})"
fi
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
  echo "version: ${EAGLE_VERSION:-dev}"
  [ -r config/includes.chroot/usr/share/eagle/chrome/id ] && echo "chrome add-on: $(cat config/includes.chroot/usr/share/eagle/chrome/id)"
  echo; echo "== Mac drivers =="; cat chroot/usr/share/eagle/mac-drivers.txt 2>/dev/null || echo "missing"
  echo "unsquashfs: $(ls chroot/usr/bin/unsquashfs 2>/dev/null || echo missing)"
  echo; echo "== Boot menu labels =="
  grep -rhoE '(menu label|menuentry) [^{]*' binary/boot binary/isolinux 2>/dev/null | sort -u
} > "$ROOT/out/$NAME-build-info.txt" 2>&1 || true

echo "Done: $ROOT/out/$NAME.iso"
