"""EAGLE-OS screensaver artwork: original, procedurally painted landscapes (no photos, no licences).

    python3 make_scenes.py OUTDIR [WIDTH HEIGHT]

Writes OUTDIR/<theme>-<n>.jpg (1920x1080 by default) and OUTDIR/thumbs/<theme>.jpg for six themes:
beach, mountains, winter, summer, fall, spring (three scenes each).
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1920, 1080


# ---------------------------------------------------------------- helpers
def rng(seed):
    return np.random.default_rng(seed)


def hexrgb(c):
    c = c.lstrip("#")
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def vgrad(stops, h=None):
    """stops: [(pos 0..1, '#rrggbb'), ...] -> (h, W, 3) float image."""
    h = h or H
    ys = np.linspace(0, 1, h)
    out = np.zeros((h, 3))
    pos = [p for p, _ in stops]
    cols = [hexrgb(c) for _, c in stops]
    for ch in range(3):
        out[:, ch] = np.interp(ys, pos, [c[ch] for c in cols])
    return np.repeat(out[:, None, :], W, axis=1)


def noise1d(r, n, octaves=6, rough=0.5):
    """Fractal 1-D value noise in -1..1 (length n)."""
    total = np.zeros(n)
    amp, freq, norm = 1.0, 4, 0.0
    x = np.linspace(0, 1, n)
    for _ in range(octaves):
        pts = r.uniform(-1, 1, freq + 1)
        total += amp * np.interp(x * freq, np.arange(freq + 1), pts)
        norm += amp
        amp *= rough
        freq *= 2
    return total / norm


def ridge(r, base, amp, octaves=7, rough=0.55, peaky=False):
    n = noise1d(r, W, octaves, rough)
    n = n / (np.abs(n).max() + 1e-6)            # use the full amplitude
    if peaky:
        n = (1 - np.abs(n)) ** 1.6 * 2 - 1      # sharp peaks, wide valleys
    return base - n * amp


def fill_below(img, heights, color, top_color=None, haze=0.0, haze_col=None):
    """Fill pixels below the height line with color (optionally vertical gradient + haze)."""
    ys = np.arange(H)[:, None]
    mask = ys >= heights[None, :]
    c1 = hexrgb(color)
    if top_color is not None:
        c0 = hexrgb(top_color)
        t = np.clip((ys - heights[None, :]) / 260.0, 0, 1)[..., None]
        col = c0 * (1 - t) + c1 * t
    else:
        col = np.broadcast_to(c1, (H, W, 3))
    if haze and haze_col is not None:
        col = col * (1 - haze) + hexrgb(haze_col) * haze
    img[mask] = np.broadcast_to(col, (H, W, 3))[mask]
    return mask


def snowcaps(img, heights, depth=70, col="#f4f7fb", r=None, snowline=0.45):
    """Snow on the upper part of a ridge: a band following the ridge line, only where the
    ridge rises above the snowline (fraction between highest and lowest point)."""
    ys = np.arange(H)[:, None]
    lo, hi = heights.min(), heights.max()
    line = lo + (hi - lo) * snowline
    wob = noise1d(r, W, 6) * 18 if r is not None else 0
    cap = np.clip((line - heights) / max(hi - lo, 1), 0, 1) * depth * 2.2 + wob
    mask = (ys >= heights[None, :]) & (ys < (heights + cap)[None, :]) & (heights[None, :] < line)
    img[mask] = img[mask] * 0.12 + hexrgb(col) * 0.88


def to_pil(img):
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")


def glow(pil, x, y, radius, color, strength=0.8):
    """Soft light: blurred alpha mask filled with a solid colour (no dark fringes)."""
    mask = Image.new("L", pil.size, 0)
    d = ImageDraw.Draw(mask)
    for i in range(12, 0, -1):
        rr = radius * i / 4
        a = int(255 * strength * (1 - i / 13) ** 2 * 0.35)
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=a)
    mask = mask.filter(ImageFilter.GaussianBlur(radius * 0.6))
    pil.paste(Image.new("RGB", pil.size, color), (0, 0), mask)


def disk(pil, x, y, radius, color):
    d = ImageDraw.Draw(pil)
    d.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color)


def clouds(pil, r, n, y0, y1, color=(255, 255, 255), alpha=150, scale=1.0):
    """Puffy clouds: flat-ish bottoms, soft edges; solid colour through a blurred mask."""
    mask = Image.new("L", pil.size, 0)
    shade = Image.new("L", pil.size, 0)
    d = ImageDraw.Draw(mask)
    ds = ImageDraw.Draw(shade)
    for _ in range(n):
        cx, cy = r.uniform(-100, W + 100), r.uniform(y0, y1)
        w = r.uniform(200, 460) * scale
        for _ in range(12):
            ox, oy = r.normal(0, w * 0.26), -abs(r.normal(0, w * 0.07))
            rw, rh = r.uniform(0.18, 0.36) * w, r.uniform(0.12, 0.22) * w
            d.ellipse([cx + ox - rw, cy + oy - rh, cx + ox + rw, cy + oy + rh], fill=alpha)
        ds.rectangle([cx - w * 0.6, cy + w * 0.02, cx + w * 0.6, cy + w * 0.2], fill=int(alpha * 0.35))
    mask = mask.filter(ImageFilter.GaussianBlur(7 * scale))
    shade = Image.composite(shade, Image.new("L", pil.size, 0), mask).filter(ImageFilter.GaussianBlur(10 * scale))
    pil.paste(Image.new("RGB", pil.size, color), (0, 0), mask)
    under = tuple(int(c * 0.82) for c in color)
    pil.paste(Image.new("RGB", pil.size, under), (0, 0), shade)


def stars(pil, r, n, ymax):
    d = ImageDraw.Draw(pil)
    for _ in range(n):
        x, y = r.uniform(0, W), r.uniform(0, ymax) ** 1.0
        b = int(r.uniform(140, 255))
        s = r.choice([0.6, 0.8, 1.0, 1.4])
        d.ellipse([x - s, y - s, x + s, y + s], fill=(b, b, min(255, b + 15)))


def water(img, horizon, r, sky_flip=True, tint="#1d4f6e", tint_amt=0.45, shimmer=0.06):
    """Reflect the sky above the horizon into a water surface below it."""
    hz = int(horizon)
    below = H - hz
    src = img[max(0, hz - below):hz][::-1] if sky_flip else img[hz:H]
    if src.shape[0] < below:
        src = np.concatenate([src, np.repeat(src[-1:], below - src.shape[0], axis=0)])
    refl = src[:below].copy()
    refl = refl * (1 - tint_amt) + hexrgb(tint) * tint_amt
    # horizontal shimmer lines
    rows = np.arange(below)
    lines = (np.sin(rows[:, None] * 0.9 + noise1d(r, W, 4)[None, :] * 8) * 0.5 + 0.5)
    refl = refl * (1 - shimmer * lines[..., None])
    img[hz:] = refl
    # darken toward the bottom
    fade = np.linspace(0, 0.35, below)[:, None, None]
    img[hz:] = img[hz:] * (1 - fade)


def sun_path(pil, x, horizon, width, color, r):
    d = ImageDraw.Draw(pil, "RGBA")
    for i in range(60):
        y = horizon + 4 + i * (H - horizon) / 60
        w = width * (0.4 + i / 60) * r.uniform(0.5, 1.2)
        a = int(170 * (1 - i / 60))
        d.rectangle([x - w, y, x + w, y + r.uniform(1, 3)], fill=color + (a,))


def pine(d, x, base, h, color):
    w = h * 0.36
    tiers = 5
    for i in range(tiers):
        tw = w * (1 - i / tiers * 0.75)
        ty = base - h * (i / tiers) * 0.85
        d.polygon([(x - tw, ty), (x + tw, ty), (x, ty - h * 0.38)], fill=color)
    d.rectangle([x - h * 0.03, base, x + h * 0.03, base + h * 0.06], fill=color)


def snowy_pine(d, x, base, h, color, snow=(240, 245, 250)):
    pine(d, x, base, h, color)
    w = h * 0.36
    for i in range(5):
        tw = w * (1 - i / 5 * 0.75)
        ty = base - h * (i / 5) * 0.85
        d.polygon([(x - tw * 0.55, ty - h * 0.08), (x + tw * 0.35, ty - h * 0.1), (x, ty - h * 0.36)], fill=snow)


def round_tree(pil, r, x, base, h, palette, trunk=(60, 40, 30)):
    d = ImageDraw.Draw(pil)
    d.rectangle([x - h * 0.04, base - h * 0.45, x + h * 0.04, base], fill=trunk)
    for _ in range(14):
        ox, oy = r.normal(0, h * 0.18), r.normal(-h * 0.62, h * 0.12)
        rr = r.uniform(0.14, 0.24) * h
        c = palette[int(r.integers(len(palette)))]
        d.ellipse([x + ox - rr, base + oy - rr, x + ox + rr, base + oy + rr], fill=c)


def palm(pil, x, base, h, color, lean=1):
    d = ImageDraw.Draw(pil)
    pts = []
    for i in range(30):
        t = i / 29
        pts.append((x + lean * h * 0.25 * t ** 2, base - h * t))
    for i in range(len(pts) - 1):
        w = h * 0.035 * (1 - i / 40)
        d.line([pts[i], pts[i + 1]], fill=color, width=max(2, int(w)))
    tx, ty = pts[-1]
    for ang in np.linspace(-170, 10, 9):
        a = math.radians(ang)
        frond = []
        for j in range(16):
            t = j / 15
            fx = tx + math.cos(a) * h * 0.42 * t
            fy = ty + math.sin(a) * h * 0.42 * t + (h * 0.18) * t ** 2
            frond.append((fx, fy))
        for j in range(len(frond) - 1):
            d.line([frond[j], frond[j + 1]], fill=color, width=max(2, int(h * 0.02 * (1 - j / 16))))
            if j > 2:
                fx, fy = frond[j]
                d.line([(fx, fy), (fx + math.cos(a + 1.2) * h * 0.04, fy + h * 0.05)], fill=color, width=2)
                d.line([(fx, fy), (fx + math.cos(a - 1.2) * h * 0.04, fy + h * 0.05)], fill=color, width=2)


def particles(pil, r, n, color, size=(1.5, 4), ymin=0, ymax=None, blur=0.8, shape="dot"):
    layer = Image.new("RGBA", pil.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ymax = ymax or H
    for _ in range(n):
        x, y = r.uniform(0, W), r.uniform(ymin, ymax)
        s = r.uniform(*size)
        c = color[int(r.integers(len(color)))] if isinstance(color, list) else color
        if shape == "leaf":
            a = r.uniform(0, math.pi)
            pts = [(x + math.cos(a) * s * 2, y + math.sin(a) * s), (x - math.cos(a) * s * 2, y - math.sin(a) * s),
                   (x + math.sin(a) * s * 0.8, y - math.cos(a) * s * 0.8)]
            d.polygon(pts, fill=c)
        else:
            d.ellipse([x - s, y - s, x + s, y + s], fill=c)
    if blur:
        rgb = layer.convert("RGB").filter(ImageFilter.MaxFilter(3))   # spread colour under the soft edge
        alpha = layer.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
        layer = Image.merge("RGBA", (*rgb.split(), alpha))
    pil.paste(layer, (0, 0), layer)


def vignette(pil, amount=0.35):
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    v = 1 - amount * np.clip(dist - 0.5, 0, 1)
    arr = np.asarray(pil).astype(float) * v[..., None]
    return to_pil(arr)


def hills(img, r, base, amp, color, top_color=None, octaves=4, rough=0.45):
    h = ridge(r, base, amp, octaves=octaves, rough=rough)
    fill_below(img, h, color, top_color)
    return h


# ---------------------------------------------------------------- scenes
def beach_sunset(seed):
    r = rng(seed)
    hz = int(H * 0.58)
    img = vgrad([(0, "#2a1a4a"), (0.28, "#a8406a"), (0.48, "#f28a3c"), (0.58, "#ffd27a"), (1, "#ffd27a")])
    pil = to_pil(img)
    clouds(pil, r, 7, H * 0.12, H * 0.42, (255, 170, 140), 110)
    glow(pil, W * 0.62, hz - 10, 160, (255, 200, 120), 1.0)
    disk(pil, W * 0.62, hz - 10, 70, (255, 226, 160))
    img = np.asarray(pil).astype(float)
    water(img, hz, r, tint="#3a2050", tint_amt=0.35)
    pil = to_pil(img)
    sun_path(pil, W * 0.62, hz, 70, (255, 214, 150), r)
    img = np.asarray(pil).astype(float)
    sand = ridge(r, H * 0.86, 30, octaves=3)
    fill_below(img, sand, "#2b1a24", "#4a2a2e")
    pil = to_pil(img)
    palm(pil, W * 0.12, H * 0.92, H * 0.62, (24, 14, 22), lean=1)
    palm(pil, W * 0.2, H * 0.95, H * 0.45, (24, 14, 22), lean=-1)
    return vignette(pil)


def beach_day(seed):
    r = rng(seed)
    hz = int(H * 0.52)
    img = vgrad([(0, "#2f86d6"), (0.45, "#8fd0f5"), (0.52, "#d9f2ff"), (1, "#d9f2ff")])
    pil = to_pil(img)
    clouds(pil, r, 10, H * 0.08, H * 0.38, (255, 255, 255), 190)
    img = np.asarray(pil).astype(float)
    # sea: turquoise gradient
    sea = vgrad([(0, "#1b6fa8"), (0.55, "#1b6fa8"), (0.7, "#22a7b8"), (0.8, "#4fd6c7"), (1, "#4fd6c7")])
    img[hz:] = sea[hz:]
    rows = np.arange(H - hz)
    lines = np.sin(rows[:, None] * 0.7 + noise1d(r, W, 4)[None, :] * 10) * 0.5 + 0.5
    img[hz:] = img[hz:] * (1 - 0.08 * lines[..., None])
    shore = ridge(r, H * 0.8, 40, octaves=4)
    foam = ridge(r, H * 0.79, 40, octaves=4)
    fill_below(img, foam, "#e9fbff")
    fill_below(img, shore, "#f3dfb3", "#f7e6c2")
    pil = to_pil(img)
    palm(pil, W * 0.86, H * 0.97, H * 0.7, (40, 60, 40), lean=-1)
    palm(pil, W * 0.78, H * 0.99, H * 0.5, (52, 76, 48), lean=-1)
    return vignette(pil, 0.2)


def beach_night(seed):
    r = rng(seed)
    hz = int(H * 0.6)
    img = vgrad([(0, "#050a1e"), (0.4, "#14245a"), (0.6, "#3b4f8c"), (1, "#3b4f8c")])
    pil = to_pil(img)
    stars(pil, r, 500, hz - 40)
    glow(pil, W * 0.3, H * 0.22, 60, (220, 230, 255), 0.7)
    disk(pil, W * 0.3, H * 0.22, 38, (240, 244, 255))
    img = np.asarray(pil).astype(float)
    water(img, hz, r, tint="#0a1838", tint_amt=0.4)
    pil = to_pil(img)
    sun_path(pil, W * 0.3, hz, 40, (220, 230, 255), r)
    img = np.asarray(pil).astype(float)
    fill_below(img, ridge(r, H * 0.88, 25, 3), "#0b0f1e", "#151b30")
    pil = to_pil(img)
    palm(pil, W * 0.82, H * 0.95, H * 0.6, (6, 8, 16), lean=-1)
    return vignette(pil)


def mountains_dawn(seed):
    r = rng(seed)
    img = vgrad([(0, "#203a6b"), (0.35, "#6f8fc4"), (0.55, "#f2b38a"), (0.7, "#ffe2c0"), (1, "#ffe2c0")])
    pil = to_pil(img)
    glow(pil, W * 0.7, H * 0.5, 140, (255, 220, 170), 0.9)
    img = np.asarray(pil).astype(float)
    layers = [("#8ea4cf", 0.4, 200, True), ("#6b82b5", 0.52, 150, True), ("#4d6398", 0.64, 110, False),
              ("#33476f", 0.72, 110, False), ("#1f2c47", 0.84, 80, False)]
    for i, (c, base, amp, caps) in enumerate(layers):
        h = ridge(r, H * base, amp, octaves=8, peaky=i < 2)
        fill_below(img, h, c)
        if caps:
            snowcaps(img, h, depth=70, r=r)
    pil = to_pil(img)
    d = ImageDraw.Draw(pil)
    for _ in range(60):
        x = r.uniform(0, W)
        pine(d, x, H * r.uniform(0.92, 1.02), r.uniform(80, 180), (14, 22, 36))
    return vignette(pil)


def mountains_lake(seed):
    r = rng(seed)
    hz = int(H * 0.62)
    img = vgrad([(0, "#3f86d0"), (0.5, "#a9d4f2"), (0.62, "#e0f1fb"), (1, "#e0f1fb")])
    pil = to_pil(img)
    clouds(pil, r, 8, H * 0.06, H * 0.3, (255, 255, 255), 170)
    img = np.asarray(pil).astype(float)
    h1 = ridge(r, H * 0.36, 210, octaves=8, peaky=True)
    fill_below(img, h1, "#6a7fa0")
    snowcaps(img, h1, depth=90, r=r)
    h2 = ridge(r, H * 0.5, 120, octaves=7)
    fill_below(img, h2, "#3f5f5a")
    h3 = ridge(r, H * 0.58, 50, octaves=6)
    fill_below(img, h3, "#24443a")
    pil = to_pil(img)
    d = ImageDraw.Draw(pil)
    for _ in range(80):
        x = r.uniform(0, W)
        pine(d, x, hz + r.uniform(-8, 4), r.uniform(40, 90), (20, 46, 34))
    img = np.asarray(pil).astype(float)
    water(img, hz, r, tint="#1c4a5c", tint_amt=0.3, shimmer=0.08)
    return vignette(to_pil(img), 0.25)


def mountains_dusk(seed):
    r = rng(seed)
    img = vgrad([(0, "#1a1035"), (0.3, "#5a2a5e"), (0.5, "#d0603e"), (0.62, "#ffb15a"), (1, "#ffb15a")])
    pil = to_pil(img)
    glow(pil, W * 0.35, H * 0.58, 180, (255, 170, 80), 1.0)
    disk(pil, W * 0.35, H * 0.58, 55, (255, 205, 130))
    img = np.asarray(pil).astype(float)
    for c, base, amp, peaky in [("#7a3a52", 0.5, 180, True), ("#4e2440", 0.6, 150, True),
                                ("#2e1530", 0.72, 110, False), ("#170b1c", 0.85, 70, False)]:
        fill_below(img, ridge(r, H * base, amp, octaves=8, peaky=peaky), c)
    pil = to_pil(img)
    d = ImageDraw.Draw(pil)
    for _ in range(45):
        pine(d, r.uniform(0, W), H * r.uniform(0.95, 1.03), r.uniform(100, 220), (10, 5, 12))
    return vignette(pil)


def winter_forest(seed):
    r = rng(seed)
    img = vgrad([(0, "#9fb8d8"), (0.5, "#dde8f3"), (1, "#f4f8fc")])
    pil = to_pil(img)
    img = np.asarray(pil).astype(float)
    for c, base, amp in [("#c7d5e6", 0.5, 120), ("#dbe5f0", 0.62, 80), ("#eef3f8", 0.75, 50), ("#fbfdff", 0.86, 30)]:
        fill_below(img, ridge(r, H * base, amp, octaves=6), c)
    pil = to_pil(img)
    d = ImageDraw.Draw(pil)
    for layer, (lo, hi, col) in enumerate([(0.58, 0.66, (120, 140, 160)), (0.7, 0.8, (60, 85, 95)),
                                           (0.84, 1.02, (28, 52, 58))]):
        for _ in range(28 - layer * 6):
            snowy_pine(d, r.uniform(0, W), H * r.uniform(lo, hi), r.uniform(60, 120) * (1 + layer * 0.9), col)
    particles(pil, r, 900, (255, 255, 255, 220), (1.2, 3.5), blur=0.6)
    return vignette(pil, 0.2)


def winter_aurora(seed):
    r = rng(seed)
    img = vgrad([(0, "#020814"), (0.55, "#0b2240"), (0.75, "#16375a"), (1, "#16375a")])
    pil = to_pil(img)
    stars(pil, r, 700, H * 0.7)
    # aurora curtains: bright lower edge, long fading rays upward
    layer = np.zeros((H, W, 3))
    ys = np.arange(H)[:, None]
    for k, (col, y0, amp, strength) in enumerate([("#3cf2a0", 0.34, 110, 0.9), ("#4ad6ff", 0.26, 90, 0.45),
                                                  ("#a46bff", 0.2, 80, 0.35)]):
        c = hexrgb(col)
        edge = H * y0 + noise1d(r, W, 4, 0.5) * amp
        bright = 0.55 + 0.45 * noise1d(r, W, 5, 0.6)            # brightness along the curtain
        rays = 0.75 + 0.25 * noise1d(r, W, 9, 0.85)              # fine vertical rays
        dy = (edge[None, :] - ys)                                # >0 above the edge
        prof = np.where(dy >= 0, np.exp(-dy / 170.0), np.exp(dy / 14.0))
        inten = prof * (bright * rays)[None, :] * strength
        layer += inten[..., None] * c[None, None, :]
    img = np.asarray(pil).astype(float) + layer
    pil = to_pil(img).filter(ImageFilter.GaussianBlur(1.2))
    img = np.asarray(pil).astype(float)
    for c, base, amp in [("#20344e", 0.68, 90), ("#2c4664", 0.78, 50), ("#3d5a7a", 0.88, 30)]:
        fill_below(img, ridge(r, H * base, amp, octaves=6), c)
    pil = to_pil(img)
    d = ImageDraw.Draw(pil)
    for _ in range(40):
        snowy_pine(d, r.uniform(0, W), H * r.uniform(0.84, 1.03), r.uniform(90, 200), (6, 14, 22), (90, 120, 150))
    return vignette(pil)


def winter_sunrise(seed):
    r = rng(seed)
    img = vgrad([(0, "#6a85c4"), (0.35, "#c9a4cf"), (0.55, "#ffc3a8"), (1, "#ffe4d0")])
    pil = to_pil(img)
    glow(pil, W * 0.75, H * 0.55, 150, (255, 210, 180), 0.9)
    img = np.asarray(pil).astype(float)
    h = ridge(r, H * 0.42, 200, octaves=8, peaky=True)
    fill_below(img, h, "#b9b3d3")
    snowcaps(img, h, depth=120, col="#fff5f2", r=r, snowline=0.8)
    h2 = ridge(r, H * 0.6, 90, octaves=7)
    fill_below(img, h2, "#dfe3f1")
    h3 = ridge(r, H * 0.8, 40, octaves=5)
    fill_below(img, h3, "#f7f9fd")
    pil = to_pil(img)
    d = ImageDraw.Draw(pil)
    for _ in range(25):
        snowy_pine(d, r.uniform(0, W), H * r.uniform(0.82, 1.02), r.uniform(110, 240), (52, 62, 92), (250, 246, 250))
    return vignette(pil, 0.2)


def summer_hills(seed):
    r = rng(seed)
    img = vgrad([(0, "#2c7fd8"), (0.55, "#9fd3f7"), (1, "#d8f0ff")])
    pil = to_pil(img)
    glow(pil, W * 0.18, H * 0.16, 110, (255, 250, 210), 0.9)
    disk(pil, W * 0.18, H * 0.16, 48, (255, 252, 230))
    clouds(pil, r, 11, H * 0.08, H * 0.4, (255, 255, 255), 200)
    img = np.asarray(pil).astype(float)
    for c, t, base, amp in [("#7fb86a", "#93c97a", 0.55, 60), ("#5ea24b", "#79b85f", 0.66, 70),
                            ("#43883a", "#5c9e47", 0.78, 60), ("#2f6e2c", "#3f8538", 0.9, 40)]:
        hills(img, r, H * base, amp, c, t)
    pil = to_pil(img)
    for _ in range(10):
        round_tree(pil, r, r.uniform(0, W), H * r.uniform(0.62, 0.74), r.uniform(60, 110),
                   [(46, 110, 48), (60, 128, 56), (38, 96, 42)])
    particles(pil, r, 500, [(255, 230, 90, 255), (255, 255, 255, 255), (255, 140, 160, 255)], (1.5, 3.2),
              ymin=H * 0.84, blur=0)
    return vignette(pil, 0.2)


def summer_lake(seed):
    r = rng(seed)
    hz = int(H * 0.6)
    img = vgrad([(0, "#2d5fa8"), (0.35, "#ef9a6a"), (0.55, "#ffd08a"), (0.6, "#fff0c4"), (1, "#fff0c4")])
    pil = to_pil(img)
    glow(pil, W * 0.5, hz - 40, 170, (255, 220, 140), 1.0)
    disk(pil, W * 0.5, hz - 40, 60, (255, 236, 180))
    clouds(pil, r, 6, H * 0.1, H * 0.35, (255, 200, 170), 120)
    img = np.asarray(pil).astype(float)
    h = ridge(r, hz - 10, 60, octaves=6)
    fill_below(img, h, "#3c4a3a")
    pil = to_pil(img)
    for _ in range(40):
        round_tree(pil, r, r.uniform(0, W), hz + 2, r.uniform(30, 70), [(48, 64, 44), (40, 54, 38)], (30, 34, 28))
    img = np.asarray(pil).astype(float)
    water(img, hz, r, tint="#24405a", tint_amt=0.3)
    pil = to_pil(img)
    sun_path(pil, W * 0.5, hz, 60, (255, 225, 160), r)
    return vignette(pil)


def summer_field(seed):
    r = rng(seed)
    img = vgrad([(0, "#4a7fc8"), (0.45, "#f6c98a"), (0.6, "#ffe6b0"), (1, "#ffe6b0")])
    pil = to_pil(img)
    glow(pil, W * 0.8, H * 0.45, 150, (255, 220, 150), 1.0)
    disk(pil, W * 0.8, H * 0.45, 50, (255, 240, 200))
    clouds(pil, r, 6, H * 0.08, H * 0.3, (255, 235, 210), 140)
    img = np.asarray(pil).astype(float)
    fill_below(img, ridge(r, H * 0.56, 40, 5), "#9a8a52")
    fill_below(img, ridge(r, H * 0.62, 30, 5), "#d4a63a", "#c99a30")
    pil = to_pil(img)
    d = ImageDraw.Draw(pil)
    # sunflowers in rows toward the viewer
    for row in range(14):
        y = H * (0.66 + row * 0.026) ** 1.0
        size = 6 + row * 4
        for _ in range(int(50 - row * 2.5)):
            x = r.uniform(-20, W + 20)
            yy = y + r.uniform(-6, 6) * (1 + row * 0.2)
            d.line([(x, yy), (x, yy + size * 3)], fill=(60, 96, 30), width=max(1, size // 6))
            d.ellipse([x - size, yy - size, x + size, yy + size], fill=(250, 190, 30))
            d.ellipse([x - size * 0.45, yy - size * 0.45, x + size * 0.45, yy + size * 0.45], fill=(90, 50, 20))
    return vignette(pil, 0.25)


AUTUMN = [(214, 84, 32), (232, 128, 34), (244, 176, 46), (186, 52, 36), (150, 70, 30)]


def fall_forest(seed):
    r = rng(seed)
    img = vgrad([(0, "#5d86b8"), (0.5, "#f1c48f"), (1, "#f7dcb4")])
    pil = to_pil(img)
    clouds(pil, r, 7, H * 0.08, H * 0.3, (255, 240, 220), 150)
    img = np.asarray(pil).astype(float)
    for c, base, amp in [("#b9895e", 0.5, 70), ("#9a5a34", 0.62, 60), ("#7a3f22", 0.74, 50), ("#5a2c18", 0.88, 30)]:
        fill_below(img, ridge(r, H * base, amp, 5), c)
    pil = to_pil(img)
    for lo, hi, sz, n in [(0.55, 0.62, 40, 60), (0.66, 0.74, 70, 40), (0.8, 0.9, 120, 22)]:
        for _ in range(n):
            round_tree(pil, r, r.uniform(0, W), H * r.uniform(lo, hi), sz * r.uniform(0.8, 1.3), AUTUMN, (70, 40, 26))
    particles(pil, r, 160, [c + (230,) for c in AUTUMN], (3, 7), blur=0.3, shape="leaf")
    return vignette(pil, 0.25)


def fall_lake(seed):
    r = rng(seed)
    hz = int(H * 0.58)
    img = vgrad([(0, "#4f7fb4"), (0.5, "#cfe0ef"), (0.58, "#f1e6d4"), (1, "#f1e6d4")])
    pil = to_pil(img)
    clouds(pil, r, 7, H * 0.06, H * 0.3, (255, 255, 255), 170)
    img = np.asarray(pil).astype(float)
    fill_below(img, ridge(r, H * 0.42, 120, 7), "#7c6a72")
    fill_below(img, ridge(r, hz - 20, 50, 6), "#6e3a22")
    pil = to_pil(img)
    for _ in range(70):
        round_tree(pil, r, r.uniform(0, W), hz + r.uniform(-6, 2), r.uniform(50, 95), AUTUMN, (60, 36, 24))
    img = np.asarray(pil).astype(float)
    water(img, hz, r, tint="#2a3a4a", tint_amt=0.28, shimmer=0.1)
    pil = to_pil(img)
    particles(pil, r, 70, [c + (220,) for c in AUTUMN], (3, 6), ymin=hz + 10, blur=0.4, shape="leaf")
    return vignette(pil, 0.25)


def fall_mist(seed):
    r = rng(seed)
    img = vgrad([(0, "#c9b9a8"), (0.5, "#efe2cf"), (1, "#f5ebdc")])
    img = np.asarray(to_pil(img)).astype(float)
    for i, (base, amp) in enumerate([(0.45, 80), (0.55, 70), (0.66, 60), (0.78, 50), (0.9, 30)]):
        haze = 0.75 - i * 0.17
        h = ridge(r, H * base, amp, 6)
        c = ["#a65a30", "#b8562c", "#c46a2a", "#8e3b1e", "#5a2614"][i]
        fill_below(img, h, c, haze=max(0, haze), haze_col="#efe2cf")
    pil = to_pil(img)
    for _ in range(30):
        x = r.uniform(0, W)
        round_tree(pil, r, x, H * r.uniform(0.92, 1.04), r.uniform(150, 260), AUTUMN, (54, 30, 18))
    particles(pil, r, 220, [c + (235,) for c in AUTUMN], (3, 8), blur=0.2, shape="leaf")
    return vignette(pil, 0.3)


BLOSSOM = [(255, 183, 206), (255, 206, 222), (248, 160, 190), (255, 225, 236)]


def spring_blossom(seed):
    r = rng(seed)
    img = vgrad([(0, "#7fb7ea"), (0.6, "#d6ecfb"), (1, "#eef8ff")])
    pil = to_pil(img)
    clouds(pil, r, 9, H * 0.06, H * 0.36, (255, 255, 255), 190)
    img = np.asarray(pil).astype(float)
    for c, t, base, amp in [("#a6d28a", "#b6dc9a", 0.6, 50), ("#86c06a", "#98cc7c", 0.72, 50),
                            ("#64a84e", "#78b85e", 0.86, 40)]:
        hills(img, r, H * base, amp, c, t)
    pil = to_pil(img)
    for _ in range(12):
        round_tree(pil, r, r.uniform(0, W), H * r.uniform(0.62, 0.7), r.uniform(40, 70), BLOSSOM, (90, 60, 60))
    # big blossom tree in front
    round_tree(pil, r, W * 0.22, H * 0.98, 520, BLOSSOM, (84, 52, 50))
    round_tree(pil, r, W * 0.3, H * 1.0, 380, BLOSSOM, (84, 52, 50))
    particles(pil, r, 260, [c + (235,) for c in BLOSSOM], (2.5, 5.5), blur=0.3, shape="leaf")
    return vignette(pil, 0.2)


def spring_meadow(seed):
    r = rng(seed)
    img = vgrad([(0, "#5aa6e6"), (0.55, "#c4e6fa"), (1, "#e8f7ff")])
    pil = to_pil(img)
    glow(pil, W * 0.82, H * 0.14, 100, (255, 252, 220), 0.8)
    clouds(pil, r, 10, H * 0.06, H * 0.38, (255, 255, 255), 200)
    img = np.asarray(pil).astype(float)
    for c, t, base, amp in [("#9fd07c", "#b2da90", 0.56, 50), ("#7cc062", "#90cc74", 0.68, 50),
                            ("#5dab4c", "#70ba5c", 0.8, 40)]:
        hills(img, r, H * base, amp, c, t)
    pil = to_pil(img)
    flowers = [(255, 220, 60, 255), (255, 255, 255, 255), (186, 120, 255, 255), (255, 110, 150, 255), (90, 170, 255, 255)]
    for band in range(8):
        y0 = H * (0.74 + band * 0.033)
        particles(pil, r, 260, flowers, (1.8 + band * 0.7, 3 + band * 1.1), ymin=y0, ymax=y0 + H * 0.04, blur=0)
    return vignette(pil, 0.2)


def spring_rainbow(seed):
    r = rng(seed)
    img = vgrad([(0, "#7d98b8"), (0.5, "#cfdeea"), (1, "#eef4f8")])
    pil = to_pil(img)
    clouds(pil, r, 8, H * 0.02, H * 0.25, (120, 135, 160), 150, 1.4)
    # rainbow
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy, rad = W * 0.55, H * 0.95, H * 0.75
    for i, c in enumerate([(255, 60, 60), (255, 150, 40), (255, 230, 60), (80, 200, 90), (60, 140, 255), (110, 80, 220), (160, 90, 220)]):
        rr = rad - i * 14
        d.arc([cx - rr, cy - rr, cx + rr, cy + rr], 180, 360, fill=c + (120,), width=15)
    layer = layer.filter(ImageFilter.GaussianBlur(6))
    pil.paste(layer, (0, 0), layer)
    img = np.asarray(pil).astype(float)
    for c, t, base, amp in [("#8cc46e", "#9fcf82", 0.62, 45), ("#6fb058", "#82bf68", 0.74, 45), ("#549944", "#66aa52", 0.88, 35)]:
        hills(img, r, H * base, amp, c, t)
    pil = to_pil(img)
    for _ in range(8):
        round_tree(pil, r, r.uniform(0, W), H * r.uniform(0.68, 0.78), r.uniform(60, 100),
                   [(120, 190, 90), (150, 205, 110), (255, 200, 220)], (80, 60, 50))
    return vignette(pil, 0.2)


THEMES = {
    "beach": [beach_sunset, beach_day, beach_night],
    "mountains": [mountains_dawn, mountains_lake, mountains_dusk],
    "winter": [winter_forest, winter_aurora, winter_sunrise],
    "summer": [summer_hills, summer_lake, summer_field],
    "fall": [fall_forest, fall_lake, fall_mist],
    "spring": [spring_blossom, spring_meadow, spring_rainbow],
}

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(os.path.join(out, "thumbs"), exist_ok=True)
    only = sys.argv[2:] or list(THEMES)
    for theme in only:
        for i, fn in enumerate(THEMES[theme], 1):
            im = fn(1000 * i + len(theme) * 37)
            im.save(os.path.join(out, f"{theme}-{i}.jpg"), quality=84, optimize=True, progressive=True)
            if i == 1:
                im.resize((384, 216), Image.LANCZOS).save(os.path.join(out, "thumbs", f"{theme}.jpg"), quality=85)
            print("ok", theme, i)
