#!/bin/bash
# Builds eagle-os.iso. Run on Debian 13 (a spare PC, a VM, or Docker — see README).
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

cd "$(dirname "$0")"

apt-get update
apt-get install -y live-build

chmod +x auto/* config/hooks/live/*.hook.chroot config/includes.chroot/usr/local/bin/*

lb clean
lb config
lb build

mkdir -p out
mv -f live-image-amd64.hybrid.iso out/eagle-os.iso
echo "Done: $(pwd)/out/eagle-os.iso"
