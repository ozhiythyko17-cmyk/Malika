"""Generate a chill ukulele-style instrumental theme (loopable) with numpy only."""
import sys
import wave
import numpy as np

SR = 44100
BPM = 100
BEAT = 60 / BPM
rng = np.random.default_rng(7)

def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)

def pluck(freq, dur, decay=0.996):
    """Karplus-Strong plucked string."""
    n = int(SR * dur)
    period = int(SR / freq)
    buf = rng.uniform(-1, 1, period)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = decay * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out

def place(track, sig, start, gain=1.0):
    s = int(start * SR)
    e = min(len(track), s + len(sig))
    track[s:e] += sig[: e - s] * gain

# C - G - Am - F, two bars each, played twice => 16 bars
chords = {
    "C":  [60, 64, 67, 72],
    "G":  [59, 62, 67, 71],
    "Am": [57, 60, 64, 69],
    "F":  [57, 60, 65, 69],
}
bass_root = {"C": 36, "G": 43, "Am": 45, "F": 41}
prog = ["C", "G", "Am", "F"] * 2
bars = int(sys.argv[1]) if len(sys.argv) > 1 else 16
OUT = sys.argv[2] if len(sys.argv) > 2 else "theme-instrumental.wav"
total = bars * 4 * BEAT + 1.5
mix = np.zeros(int(total * SR))

for bar in range(bars):
    name = prog[(bar // 2) % len(prog)] if False else ["C","G","Am","F"][(bar // 2) % 4]
    t0 = bar * 4 * BEAT
    notes = chords[name]
    # strum pattern: D . D U . U D U (eighth notes)
    pattern = [1, 0, 1, 1, 0, 1, 1, 1]
    for i, hit in enumerate(pattern):
        if not hit:
            continue
        t = t0 + i * BEAT / 2
        down = i % 2 == 0
        order = notes if down else notes[::-1]
        for k, m in enumerate(order):
            place(mix, pluck(hz(m), 0.5), t + k * 0.012, 0.16 if down else 0.11)
    # bass on beats 1 and 3
    for b in (0, 2):
        place(mix, pluck(hz(bass_root[name]), 0.9, 0.998), t0 + b * BEAT, 0.5)
    # soft kick on 1,3 ; shaker on offbeats
    for b in (0, 2):
        tt = np.arange(int(0.18 * SR)) / SR
        kick = np.sin(2 * np.pi * (110 - 400 * tt) * tt) * np.exp(-tt * 22)
        place(mix, kick, t0 + b * BEAT, 0.45)
    for i in range(8):
        n = int(0.05 * SR)
        sh = rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / (SR * 0.012))
        place(mix, sh, t0 + i * BEAT / 2, 0.07 if i % 2 else 0.04)

# simple whistle-ish melody on bars 9-16 (pentatonic, relaxed)
melody = [(76, 1), (79, 1), (81, 2), (79, 1), (76, 1), (74, 2),
          (72, 1), (74, 1), (76, 2), (74, 1), (72, 1), (67, 2)]
t = 8 * 4 * BEAT
for _ in range(max(2, bars // 4)):
    for m, beats in melody:
        if t > total - 3:
            break
        d = beats * BEAT
        tt = np.arange(int(d * SR)) / SR
        env = np.minimum(1, tt / 0.03) * np.exp(-tt * 1.5)
        vib = np.sin(2 * np.pi * hz(m) * tt + 0.15 * np.sin(2 * np.pi * 5 * tt))
        place(mix, vib * env, t, 0.12)
        t += d

mix = mix / np.max(np.abs(mix)) * 0.85
fade = int(0.6 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
pcm = (mix * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("duration", round(len(mix) / SR, 1), "s")
