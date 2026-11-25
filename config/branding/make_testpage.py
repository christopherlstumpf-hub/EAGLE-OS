#!/usr/bin/env python3
"""Make the EAGLE-OS printer test page (a small one-page PDF, no extra libraries needed).

    make_testpage.py OUT.pdf
"""
import sys
import zlib

W, H = 612, 792  # US Letter, points


def esc(t):
    return t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def page():
    c = []
    # header band
    c.append("1 0.478 0 rg 54 700 504 4 re f")
    c.append(f"BT /F2 40 Tf 0.1 0.1 0.1 rg 54 714 Td ({esc('EAGLE-OS')}) Tj ET")
    c.append(f"BT /F1 13 Tf 0.4 0.4 0.4 rg 420 718 Td ({esc('Printer test page')}) Tj ET")
    y = 640
    lines = [
        ("F2", 18, "If you can read this, your printer works with EAGLE-OS."),
        ("F1", 12, "Below: colour and grey bars, fine lines and text sizes."),
    ]
    for font, size, text in lines:
        c.append(f"BT /{font} {size} Tf 0 0 0 rg 54 {y} Td ({esc(text)}) Tj ET")
        y -= size + 14
    # colour bars
    colours = [(0, 1, 1), (1, 0, 1), (1, 1, 0), (0, 0, 0), (1, 0.478, 0), (0.2, 0.45, 0.85), (0.3, 0.65, 0.35), (0.85, 0.2, 0.2)]
    x = 54
    for r, g, b in colours:
        c.append(f"{r} {g} {b} rg {x} 470 58 80 re f")
        x += 63
    # grey ramp
    for i in range(11):
        v = i / 10
        c.append(f"{v} {v} {v} rg {54 + i * 45.8:.1f} 420 45.8 30 re f")
    c.append("0 0 0 RG 0.5 w 54 420 504 30 re S")
    # fine lines
    for i, wdt in enumerate([0.25, 0.5, 1, 2, 4]):
        c.append(f"0 0 0 RG {wdt} w 54 {380 - i * 14} m 558 {380 - i * 14} l S")
    # text sizes
    y = 290
    for size in (6, 8, 10, 12, 16, 24):
        sample = 'The quick brown fox 0123456789' if size >= 16 else 'The quick brown fox jumps over the lazy dog 0123456789'
        c.append(f"BT /F1 {size} Tf 0 0 0 rg 54 {y} Td ({esc(f'{size} pt  ' + sample)}) Tj ET")
        y -= size + 10
    # border and footer
    c.append("0.6 0.6 0.6 RG 1 w 36 36 540 720 re S")
    c.append(f"BT /F1 10 Tf 0.4 0.4 0.4 rg 54 50 Td ({esc('EAGLE-OS by Stumpf Technology')}) Tj ET")
    return "\n".join(c).encode()


def main():
    content = zlib.compress(page())
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Contents 4 0 R "
        f"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>".encode(),
        f"<< /Length {len(content)} /Filter /FlateDecode >>\nstream\n".encode() + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    open(sys.argv[1], "wb").write(out)


if __name__ == "__main__":
    main()
