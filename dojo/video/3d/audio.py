"""Bande-son synthétisée de la vidéo 3D (rythme + bruitages calés sur les coups)."""
import sys
import wave

import numpy as np

DURATION, SR = 20.0, 44100
HITS = [(3.8, 1.0), (4.5, 1.2), (5.5, 1.0), (5.9, 1.2), (8.0, 2.0), (11.7, 0.7), (13.2, 0.7), (13.55, 0.9), (15.8, 1.6)]
CUTS = [3.0, 6.5, 10.5, 15.0]


def main(path, version):
    kids = version == "kids"
    n = int(DURATION * SR)
    out = np.zeros(n, np.float32)
    rng = np.random.default_rng(21)
    tt = lambda d: np.arange(int(d * SR)) / SR

    def add(sig, start, g=1.0):
        a = int(start * SR)
        b = min(n, a + len(sig))
        if 0 <= a < n:
            out[a:b] += sig[: b - a] * g

    def kick(amp=1.0):
        x = tt(0.45)
        return amp * np.sin(2 * np.pi * np.cumsum(45 + 130 * np.exp(-x * 30)) / SR) * np.exp(-x * 7)

    def snare(amp=0.4):
        x = tt(0.22)
        return amp * rng.normal(0, 1, len(x)) * np.exp(-x * 20)

    def hat(amp=0.1):
        x = tt(0.05)
        return amp * rng.normal(0, 1, len(x)) * np.exp(-x * 90)

    def punch(amp=1.0, low=60):
        x = tt(0.7)
        body = np.sin(2 * np.pi * np.cumsum(low + 220 * np.exp(-x * 40)) / SR) * np.exp(-x * 8)
        return amp * (body + 0.8 * rng.normal(0, 1, len(x)) * np.exp(-x * 40))

    def whoosh(d=0.3, amp=0.5):
        x = tt(d)
        sm = np.convolve(rng.normal(0, 1, len(x)), np.ones(25) / 25, mode="same")
        return amp * 3 * sm * np.sin(np.pi * x / d) ** 2

    def note(f, d=0.5, amp=0.12):
        x = tt(d)
        return amp * (np.sin(2 * np.pi * f * x) + 0.4 * np.sign(np.sin(2 * np.pi * f * x))) * np.exp(-x * 5)

    x = tt(DURATION)
    env = np.minimum(1, x / 1.5) * np.minimum(1, (DURATION - x) / 1.2)
    root = 65.4 if kids else 55.0
    out += ((np.sin(2 * np.pi * root * x) + 0.5 * np.sin(2 * np.pi * root * 1.5 * x)) * env * 0.07).astype(np.float32)
    beat = 60 / (132 if kids else 126)
    scale = [1, 1.2, 1.5, 1.2, 1.335, 1.5, 2, 1.5] if not kids else [1, 1.26, 1.5, 2, 1.5, 1.26, 1.68, 1.5]
    for k in range(int(DURATION / (beat / 2))):
        tb = k * beat / 2
        st = k % 8
        if 3.0 <= tb < DURATION - 1:
            if st in (0, 3, 4):
                add(kick(0.75), tb)
            if st in (2, 6):
                add(snare(0.33), tb)
            add(hat(0.07 if st % 2 else 0.11), tb)
            add(note(root * 4 * scale[st], 0.3, 0.07), tb)
        elif st == 0:
            add(kick(0.5), tb)
    for c in CUTS:
        add(whoosh(0.3, 0.4), c - 0.25)
        add(kick(1.0), c)
    for h, a in HITS:
        add(whoosh(0.35 if a > 1.5 else 0.18, 0.4), h - (0.35 if a > 1.5 else 0.18))
        add(punch(a, 45 if a > 1.5 else 65), h)
    # ralenti du high kick : grave qui descend
    xs = tt(1.5)
    add(0.25 * np.sin(2 * np.pi * np.cumsum(90 * np.exp(-xs * 1.2) + 30) / SR) * np.exp(-xs * 1.5), 8.0)
    out = out / (np.max(np.abs(out)) + 1e-6) * 0.9
    f = int(0.8 * SR)
    out[-f:] *= np.linspace(1, 0, f)
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "adults")
