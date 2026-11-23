"""EAGLE-OS startup chime (original): a warm rising A-major-9 arpeggio with a soft low swell
and a short shimmer tail. Writes 48 kHz 16-bit stereo WAV.  python3 make_chime.py OUT.wav"""
import sys, wave
import numpy as np

SR = 48000
DUR = 3.2
t = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t); R = np.zeros_like(t)

def tone(freq, start, length, amp, pan):
    n0 = int(start * SR); n = int(length * SR)
    tt = np.arange(n) / SR
    env = (1 - np.exp(-tt / 0.012)) * np.exp(-tt / (length * 0.38))      # quick attack, smooth decay
    w = (np.sin(2 * np.pi * freq * tt)
         + 0.35 * np.sin(2 * np.pi * 2 * freq * tt + 0.3) * np.exp(-tt / 0.35)   # bell-like overtone
         + 0.12 * np.sin(2 * np.pi * 3.01 * freq * tt) * np.exp(-tt / 0.18))
    s = amp * env * w
    end = min(n0 + n, len(t)); s = s[: end - n0]
    L[n0:end] += s * (1 - pan) ; R[n0:end] += s * (1 + pan)

# rising arpeggio: A3 E4 A4 C#5 E5 B5
notes = [(220.00, 0.00, -0.30), (329.63, 0.11, -0.15), (440.00, 0.22, 0.0),
         (554.37, 0.33, 0.15), (659.26, 0.44, 0.25), (987.77, 0.58, 0.35)]
for f, st, pan in notes:
    tone(f, st, DUR - st, 0.20 if f < 900 else 0.10, pan)

# low swell under it (A2 + E3)
sw = np.clip(t / 0.6, 0, 1) * np.exp(-np.clip(t - 0.6, 0, None) / 0.9)
low = 0.16 * sw * (np.sin(2 * np.pi * 110 * t) + 0.5 * np.sin(2 * np.pi * 164.81 * t))
L += low; R += low

# simple stereo reverb: a few feedback delays
def reverb(x, delays, fb=0.35, mix=0.28):
    y = x.copy()
    for d in delays:
        n = int(d * SR); buf = np.zeros_like(x)
        buf[n:] = x[:-n] * fb
        buf[2 * n:] += x[:-2 * n] * fb * fb
        y += buf * mix
    return y
L = reverb(L, [0.031, 0.067, 0.113]); R = reverb(R, [0.037, 0.073, 0.127])

# fade out the tail and normalise to -3 dBFS
fade = np.clip((DUR - t) / 0.6, 0, 1)
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
g = (10 ** (-3 / 20)) / peak
st = np.stack([L * g, R * g], axis=1)
pcm = (st * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok", round(len(t) / SR, 2), "s")
