#!/usr/bin/env python3
"""Pack the EAGLE add-on for Google Chrome (Manifest V3) as a signed CRX3.

    make_chrome_ext.py ADDON_DIR OUT_DIR VERSION [KEY.pem]

Writes to OUT_DIR:
    eagle-menu.crx   the add-on
    update.xml       Chrome's update manifest (Chrome fetches it from http://127.0.0.1:8743/)
    id               the extension ID
A new signing key is made when none is given; the ID then changes with every build, which is
fine because the Chrome policy and native messaging host are generated from the same ID.
"""
import base64, hashlib, io, json, os, struct, sys, zipfile

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

LOCAL_URL = "http://127.0.0.1:8743"


def varint(n):
    out = b""
    while True:
        b = n & 0x7F
        n >>= 7
        out += bytes([b | (0x80 if n else 0)])
        if not n:
            return out


def field(num, data):  # length-delimited protobuf field
    return varint((num << 3) | 2) + varint(len(data)) + data


def main():
    addon, out, version = sys.argv[1:4]
    keyfile = sys.argv[4] if len(sys.argv) > 4 else ""
    if keyfile and os.path.exists(keyfile):
        key = serialization.load_pem_private_key(open(keyfile, "rb").read(), None)
    else:
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    crx_id = hashlib.sha256(pub).digest()[:16]
    ext_id = "".join(chr(ord("a") + int(c, 16)) for c in crx_id.hex())

    # Chrome manifest replaces the Firefox one
    man = json.load(open(os.path.join(addon, "manifest-chrome.json")))
    man["version"] = version
    man["key"] = base64.b64encode(pub).decode()
    files = {}
    for root, _, names in os.walk(addon):
        for n in names:
            p = os.path.join(root, n)
            rel = os.path.relpath(p, addon)
            if rel in ("manifest.json", "manifest-chrome.json"):
                continue
            files[rel] = open(p, "rb").read()
    files["manifest.json"] = json.dumps(man, indent=2).encode()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in sorted(files):
            info = zipfile.ZipInfo(rel, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, files[rel])
    archive = buf.getvalue()

    signed_data = field(1, crx_id)
    msg = b"CRX3 SignedData\x00" + struct.pack("<I", len(signed_data)) + signed_data + archive
    sig = key.sign(msg, padding.PKCS1v15(), hashes.SHA256())
    header = field(2, field(1, pub) + field(2, sig)) + field(10000, signed_data)
    crx = b"Cr24" + struct.pack("<I", 3) + struct.pack("<I", len(header)) + header + archive

    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, "eagle-menu.crx"), "wb").write(crx)
    open(os.path.join(out, "id"), "w").write(ext_id + "\n")
    open(os.path.join(out, "update.xml"), "w").write(
        "<?xml version='1.0' encoding='UTF-8'?>\n"
        "<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>\n"
        f"  <app appid='{ext_id}'>\n"
        f"    <updatecheck codebase='{LOCAL_URL}/eagle-menu.crx' version='{version}' />\n"
        "  </app>\n</gupdate>\n")
    print(ext_id)


if __name__ == "__main__":
    main()
