"""Generates the EAGLE-OS art: chrome lettering on black, orange accent, Stumpf Technology byline.

    python3 make_logo.py OUTDIR            # standard edition
    python3 make_logo.py OUTDIR LITE       # Lite edition (orange LITE under the logo)

Writes:
  splash-1920x1080.png / splash-1024x768.png / splash-640x480.png   centered (start page, previews)
  menu-1920x1080.png / menu-640x480.png                             logo high, room for the boot menu below
  logo.png                                                          transparent (startup animation, start page)
  icon-64.png / icon-128.png                                        toolbar button icon
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

FONT_DIR = "/usr/share/fonts/truetype/google-fonts/ofl"
FONT = f"{FONT_DIR}/archivoblack/ArchivoBlack-Regular.ttf"
BYLINE_FONT_CANDIDATES = [
    f"{FONT_DIR}/montserrat/Montserrat[wght].ttf",
    f"{FONT_DIR}/montserrat/Montserrat-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
ORANGE = (255, 122, 0)
GREY = (150, 152, 158)
BYLINE = "by Stumpf Technology"


def byline_font(size):
    for f in BYLINE_FONT_CANDIDATES:
        if os.path.exists(f):
            font = ImageFont.truetype(f, size)
            try:
                font.set_variation_by_name("Medium")
            except Exception:
                pass
            return font
    return ImageFont.load_default()


def chrome_text(text, height):
    font = ImageFont.truetype(FONT, height)
    bbox = font.getbbox(text)
    w, h = bbox[2] - bbox[0] + 40, bbox[3] - bbox[1] + 40
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).text((20 - bbox[0], 20 - bbox[1]), text, font=font, fill=255)
    # vertical chrome gradient: bright top, dark band at the horizon, bright reflection, grey base
    stops = [(0.0, (250, 250, 252)), (0.30, (200, 204, 210)), (0.48, (95, 98, 105)), (0.52, (45, 47, 52)),
             (0.60, (170, 174, 182)), (0.80, (235, 237, 240)), (1.0, (140, 143, 150))]
    grad = Image.new("RGB", (1, h))
    top, bot = 20, h - 20
    for y in range(h):
        t = min(max((y - top) / max(bot - top, 1), 0), 1)
        for i in range(len(stops) - 1):
            a, ca = stops[i]
            b, cb = stops[i + 1]
            if a <= t <= b:
                k = (t - a) / (b - a)
                grad.putpixel((0, y), tuple(int(ca[j] + (cb[j] - ca[j]) * k) for j in range(3)))
                break
    grad = grad.resize((w, h))
    outline = mask.filter(ImageFilter.MaxFilter(5))
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    img.paste((30, 30, 34, 255), (0, 0), outline)
    img.paste(grad, (0, 0), mask)
    inner = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(3)))
    hl = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    hl.putalpha(inner.point(lambda v: int(v * 0.55)))
    return Image.alpha_composite(img, hl)


def centered_text(draw, W, y, text, font, fill):
    b = font.getbbox(text)
    draw.text(((W - (b[2] - b[0])) // 2 - b[0], y - b[1]), text, font=font, fill=fill)
    return y + (b[3] - b[1])


def lockup(text_h, subtitle=None):
    """Logo + orange rule + optional LITE + byline, on transparent background."""
    logo = chrome_text("EAGLE-OS", text_h)
    gap = max(6, text_h // 12)
    rule_h = max(3, text_h // 40)
    sub_font = ImageFont.truetype(FONT, max(14, text_h // 3)) if subtitle else None
    by_font = byline_font(max(12, text_h // 5))
    sub_h = (sub_font.getbbox(subtitle)[3] - sub_font.getbbox(subtitle)[1] + gap) if subtitle else 0
    by_h = by_font.getbbox(BYLINE)[3] - by_font.getbbox(BYLINE)[1]
    H = logo.height + gap + rule_h + gap + sub_h + gap + by_h + gap
    W = logo.width
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.alpha_composite(logo, (0, 0))
    d = ImageDraw.Draw(img)
    y = logo.height + gap
    rw = int(W * 0.5)
    d.rectangle([(W - rw) // 2, y, (W - rw) // 2 + rw, y + rule_h], fill=ORANGE + (255,))
    y += rule_h + gap
    if subtitle:
        y = centered_text(d, W, y, subtitle, sub_font, ORANGE + (255,)) + gap
    centered_text(d, W, y + gap // 2, BYLINE, by_font, GREY + (255,))
    return img


def compose(size, text_h, out, subtitle=None, center_y=0.5):
    W, H = size
    bg = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    art = lockup(text_h, subtitle)
    if art.width > W * 0.86:
        r = W * 0.86 / art.width
        art = art.resize((int(art.width * r), int(art.height * r)), Image.LANCZOS)
    x = (W - art.width) // 2
    y = int(H * center_y - art.height / 2)
    bg.alpha_composite(art, (x, max(0, y)))
    bg.convert("RGB").save(out)


def icon(size, out):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([1, 1, size - 2, size - 2], fill=(12, 12, 12, 255), outline=ORANGE + (255,), width=max(2, size // 16))
    e = chrome_text("E", int(size * 0.62))
    e.thumbnail((int(size * 0.62), int(size * 0.62)), Image.LANCZOS)
    img.alpha_composite(e, ((size - e.width) // 2, (size - e.height) // 2))
    img.save(out)


if __name__ == "__main__":
    out = sys.argv[1]
    sub = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    compose((1920, 1080), 230, f"{out}/splash-1920x1080.png", sub)
    compose((1024, 768), 140, f"{out}/splash-1024x768.png", sub)
    compose((640, 480), 90, f"{out}/splash-640x480.png", sub)
    # boot menu backgrounds: logo in the top third, menu drawn below it
    compose((1920, 1080), 190, f"{out}/menu-1920x1080.png", sub, center_y=0.27)
    compose((640, 480), 70, f"{out}/menu-640x480.png", sub, center_y=0.25)
    lockup(200, sub).save(f"{out}/logo.png")
    icon(64, f"{out}/icon-64.png")
    icon(128, f"{out}/icon-128.png")
    print("ok")
