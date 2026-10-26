"""Voice, sound design and timing data for the 1-minute video.

Outputs (in <out_dir>):
  mix.wav        final stereo-ready mix (voice + ducked music + sfx), loudness-normalised
  timings.js     window.TIMINGS = {...}  consumed by the HTML motion scenes

Voice: Piper (Indonesian) by default. To use a better voice, drop one file per
line into <voice_dir> as line01.wav ... line10.wav (e.g. exported from ElevenLabs,
Google/Azure TTS or your own recording); durations and captions re-time automatically.

Usage: python3 make_audio.py <piper_model.onnx> <music.wav> <out_dir> [voice_dir]
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

MODEL, MUSIC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
VOICE_DIR = sys.argv[4] if len(sys.argv) > 4 else None
FPS, SR = 30, 44100
rng = np.random.default_rng(11)

# Spoken text (numbers spelled out for TTS) and on-screen text.
LINES = [
    ("Kamu pernah nanya hal memalukan ke chatbot, tapi nggak berani nanya ke manusia?",
     "Kamu pernah nanya hal memalukan ke chatbot, tapi nggak berani nanya ke manusia?"),
    ("Tenang. Kamu nggak sendirian, dan ini ada penjelasannya.",
     "Tenang. Kamu nggak sendirian, dan ini ada penjelasannya."),
    ("Contohnya: ada diskon nggak? Bisa dicicil nggak? Atau, ini pertanyaan bodoh nggak ya?",
     "Contohnya: ada diskon nggak? Bisa dicicil nggak? Atau, ini pertanyaan bodoh nggak ya?"),
    ("Riset tahun dua ribu empat belas menemukan, orang cenderung lebih terbuka ke sistem yang nggak menghakimi.",
     "Riset 2014 menemukan, orang cenderung lebih terbuka ke sistem yang nggak menghakimi."),
    ("Nggak ada alis naik. Nggak ada helaan napas. Nggak ada, hah, gitu aja nanya?",
     "Nggak ada alis naik. Nggak ada helaan napas. Nggak ada, \"hah, gitu aja nanya?\""),
    ("Artinya, pembeli yang diam belum tentu nggak minat. Bisa jadi, dia cuma malu bertanya.",
     "Artinya, pembeli yang diam belum tentu nggak minat. Bisa jadi, dia cuma malu bertanya."),
    ("Jadi bikin ruang aman: ramah, tanpa menghakimi, dua puluh empat jam. Itu kerjaan Asamerta A I.",
     "Jadi bikin ruang aman: ramah, tanpa menghakimi, 24 jam. Itu kerjaan Asamerta AI."),
    ("Tapi urusan hati, kayak komplain atau pembeli yang lagi sedih, tetap manusia yang pegang.",
     "Tapi urusan hati, kayak komplain atau pembeli yang lagi sedih, tetap manusia yang pegang."),
    ("Simpan video ini buat temen yang malu nanya. Komen Asamerta, nanti aku kirim contohnya.",
     "Simpan video ini buat temen yang malu nanya. Komen \"Asamerta\", nanti aku kirim contohnya."),
    ("Santai aja, biar Asamerta!", "Santai aja, biar Asamerta!"),
]


def read_wav(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2:
            a = a.reshape(-1, 2).mean(axis=1)
        return a, w.getframerate()


def write_wav(path, a, sr, channels=1):
    with wave.open(path, "wb") as w:
        w.setnchannels(channels); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())


def trim(a, thr=0.008):
    idx = np.where(np.abs(a) > thr)[0]
    return a[idx[0]: idx[-1] + 1] if len(idx) else a


def resample(a, sr_from, sr_to):
    return np.interp(np.arange(int(len(a) * sr_to / sr_from)) * sr_from / sr_to, np.arange(len(a)), a)


# ---------------------------------------------------------------- voice
piper_voice = None


def tts(text, idx):
    ext = os.path.join(VOICE_DIR, f"line{idx + 1:02d}.wav") if VOICE_DIR else None
    if ext and os.path.exists(ext):
        a, sr = read_wav(ext)
        return resample(trim(a), sr, SR)
    global piper_voice
    from piper import PiperVoice, SynthesisConfig
    if piper_voice is None:
        piper_voice = PiperVoice.load(MODEL)
    cfg = SynthesisConfig(length_scale=0.97, noise_scale=0.8, noise_w_scale=1.0)
    parts = [p for p in re.split(r"(?<=[.?!])\s+", text) if p]
    out = []
    for p in parts:
        path = f"{OUT}/_seg.wav"
        with wave.open(path, "wb") as w:
            piper_voice.synthesize_wav(p, w, syn_config=cfg)
        a, sr = read_wav(path)
        a = resample(trim(a), sr, SR)
        out.append(a)
        pause = 0.24 if p.endswith("?") else 0.17
        out.append(np.zeros(int(pause * SR)))
    return np.concatenate(out[:-1])


os.makedirs(OUT, exist_ok=True)
clips = [tts(s, i) for i, (s, _) in enumerate(LINES)]
GAP, T0 = 0.26, 0.45
starts, t = [], T0
for c in clips:
    starts.append(t)
    t += len(c) / SR + GAP
ends = [s + len(c) / SR for s, c in zip(starts, clips)]
TOTAL = ends[-1] + 1.4
assert TOTAL <= 60, f"video too long: {TOTAL:.1f}s"

voice = np.zeros(int(TOTAL * SR))
for s, c in zip(starts, clips):
    i = int(s * SR)
    voice[i: i + len(c)] += c
voice = voice / np.max(np.abs(voice)) * 0.9
write_wav(f"{OUT}/_voice_raw.wav", voice, SR)
# broadcast-style voice chain: clean low end, warmth, presence, gentle compression, short room
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{OUT}/_voice_raw.wav", "-af",
                "highpass=f=90,equalizer=f=180:t=q:w=1:g=2.5,equalizer=f=3200:t=q:w=1:g=2.5,"
                "equalizer=f=7500:t=q:w=2:g=-3,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=3,"
                "aecho=0.85:0.9:38|71:0.12|0.07", f"{OUT}/_voice.wav"], check=True)
voice, _ = read_wav(f"{OUT}/_voice.wav")
voice = voice / np.max(np.abs(voice)) * 0.9

# ---------------------------------------------------------------- sfx
def env_exp(n, k):
    return np.exp(-np.arange(n) / (SR * k))


def sfx_whoosh(dur=0.55, lo=300, hi=5000):
    n = int(dur * SR)
    noise = rng.uniform(-1, 1, n)
    out = np.zeros(n)
    y = 0.0
    for i in range(n):
        f = lo + (hi - lo) * np.sin(np.pi * i / n) ** 2
        a = min(1.0, 2 * np.pi * f / SR)
        y += a * (noise[i] - y)
        out[i] = y
    return out * np.sin(np.pi * np.arange(n) / n) ** 1.5 * 0.9


def sfx_tick():
    n = int(0.018 * SR)
    return rng.uniform(-1, 1, n) * env_exp(n, 0.003) * 0.6


def sfx_pop(freq=720):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * (freq - 2200 * tt) * tt) * env_exp(n, 0.03)


def sfx_ding():
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1318 * tt) + 0.5 * np.sin(2 * np.pi * 1976 * tt)) * env_exp(n, 0.18) * 0.5


vs = [0.0] + [s - 0.12 for s in starts[1:]] + [TOTAL]
sfx = np.zeros(len(voice))


def put(sig, at, g=1.0):
    i = int(at * SR)
    if 0 <= i < len(sfx):
        e = min(len(sfx), i + len(sig))
        sfx[i:e] += sig[: e - i] * g


# NOTE: scene-0 and scene-6 offsets mirror the timelines in scenes.js.
for i in range(1, len(vs) - 1):
    put(sfx_whoosh(), vs[i] - 0.15, 0.22)
for k in range(10):
    put(sfx_tick(), 0.55 + k * 0.11, 0.35)          # typing to the human
for k in range(9):
    put(sfx_tick(), 1.95 + k * 0.07, 0.3)           # deleting
put(sfx_pop(), 2.95, 0.35)                          # switch to chatbot
for k in range(9):
    put(sfx_tick(), 3.15 + k * 0.09, 0.35)          # typing to the chatbot
put(sfx_whoosh(0.3, 800, 6000), 4.2, 0.3)
put(sfx_ding(), 4.25, 0.22)                         # sent
for off in (2.0, 3.0, 4.4):
    put(sfx_pop(900), vs[6] + off, 0.3)             # checklist pops
put(sfx_ding(), vs[8] + 4.35, 0.2)                   # comment sent

# ---------------------------------------------------------------- music + mix
m, msr = read_wav(MUSIC)
music = np.zeros(len(voice))
music[: min(len(m), len(music))] = m[: len(music)]
win = int(0.15 * SR)
env = np.clip(np.convolve(np.abs(voice), np.ones(win) / win, mode="same") / 0.1, 0, 1)
gain = 0.32 - 0.22 * env
gain[: int(T0 * SR)] = 0.5
gain[int(starts[-1] * SR):] = 0.45
mix = voice * 1.0 + music * gain + sfx
fade = int(0.9 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
write_wav(f"{OUT}/_mix_raw.wav", mix / np.max(np.abs(mix)) * 0.95, SR)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{OUT}/_mix_raw.wav", "-af",
                "loudnorm=I=-14:TP=-1.5:LRA=7", "-ar", "48000", f"{OUT}/mix.wav"], check=True)

# ---------------------------------------------------------------- captions (max 2 lines)
MAXC = 52


def chunks_for(text):
    """Split into short chunks that always fit in 2 lines."""
    pieces = [p for p in re.findall(r"[^.?!,:]+[.?!,:]*[\"”]?\s*", text) if p.strip()]
    out, cur = [], ""
    for p in pieces:
        p = p.strip()
        if cur and len(cur) + 1 + len(p) > MAXC:
            out.append(cur); cur = p
        else:
            cur = (cur + " " + p).strip()
    if cur:
        out.append(cur)
    final = []
    for c in out:
        while len(c) > MAXC:
            cut = c.rfind(" ", 0, MAXC)
            final.append(c[:cut]); c = c[cut + 1:]
        final.append(c)
    return final


timing = {"fps": FPS, "total": TOTAL, "vs": vs, "lines": [], "starts": starts, "ends": ends}
for (spoken, cap), s, e in zip(LINES, starts, ends):
    chunks = chunks_for(cap)
    weights = np.array([len(c) + (4 if c[-1] in ".?!" else 2) for c in chunks], float)
    edges = np.concatenate([[0], np.cumsum(weights)]) / weights.sum() * (e - s) + s
    items = []
    for c, a, b in zip(chunks, edges[:-1], edges[1:]):
        words = c.split()
        ww = np.array([len(w) + 1 for w in words], float)
        we = np.concatenate([[0], np.cumsum(ww)]) / ww.sum() * (b - a) + a
        items.append({"start": a, "end": b, "words": [{"w": w, "s": x, "e": y} for w, x, y in zip(words, we[:-1], we[1:])]})
    timing["lines"].append({"start": s, "end": e, "chunks": items})

# voice amplitude envelope per video frame (drives the orb / waveforms)
NF = int(TOTAL * FPS)
amp = np.zeros(NF)
for f in range(NF):
    seg = voice[int(f / FPS * SR): int((f + 1) / FPS * SR)]
    amp[f] = np.sqrt(np.mean(seg ** 2)) if len(seg) else 0
amp = np.clip(amp / (np.percentile(amp[amp > 0], 92) + 1e-6), 0, 1)
timing["amp"] = [round(float(x), 3) for x in amp]

with open(f"{OUT}/timings.js", "w", encoding="utf-8") as f:
    f.write("window.TIMINGS = " + json.dumps(timing, ensure_ascii=False) + ";")
with open(f"{OUT}/captions.srt", "w", encoding="utf-8") as f:
    def fmt(t):
        ms = int(round(t * 1000))
        return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"
    n = 0
    for ln in timing["lines"]:
        for c in ln["chunks"]:
            n += 1
            txt = " ".join(w["w"] for w in c["words"])
            f.write(f"{n}\n{fmt(c['start'])} --> {fmt(c['end'])}\n{txt}\n\n")
print(f"total {TOTAL:.1f}s, {sum(len(l['chunks']) for l in timing['lines'])} caption chunks, scene starts {[round(v, 1) for v in vs]}")
