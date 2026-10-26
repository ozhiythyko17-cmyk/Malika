"""Build the <=60s portrait video "Kenapa orang lebih jujur ke bot?".

Pipeline: Piper TTS (Indonesian) -> voice track -> ducked mix with the theme
instrumental -> PIL-drawn frames piped to ffmpeg -> burned-in captions + .srt.

Usage:
    python3 build.py <piper_model.onnx> <music.wav> <out_dir>
"""
import math
import subprocess
import sys
import wave

import numpy as np
from piper import PiperVoice, SynthesisConfig
from PIL import Image, ImageDraw, ImageFont

MODEL, MUSIC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H, FPS = 1080, 1920, 30
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

NAVY, CREAM, CORAL, TEAL, YELLOW, PINK = (
    (28, 36, 64), (255, 245, 228), (255, 107, 91), (46, 196, 182), (255, 210, 63), (255, 170, 190))

# (voice text, caption text) -- last line is the jingle chant
LINES = [
    "Kamu pernah nanya hal memalukan ke chatbot, tapi nggak berani nanya ke manusia?",
    "Tenang. Kamu nggak sendirian, dan ini ada penjelasannya.",
    "Contohnya: ada diskon nggak? Bisa dicicil nggak? Atau, ini pertanyaan bodoh nggak ya?",
    "Riset tahun dua ribu empat belas menemukan, orang cenderung lebih terbuka ke sistem yang nggak menghakimi.",
    "Nggak ada alis naik. Nggak ada helaan napas. Nggak ada, hah, gitu aja nanya?",
    "Artinya, pembeli yang diam belum tentu nggak minat. Bisa jadi, dia cuma malu bertanya.",
    "Jadi bikin ruang aman: ramah, tanpa menghakimi, dua puluh empat jam. Itu kerjaan AI agent seperti Malika.",
    "Tapi urusan hati, kayak komplain atau pembeli yang lagi sedih, tetap manusia yang pegang.",
    "Simpan video ini buat temen yang malu nanya. Komen Malika, nanti aku kirim contohnya.",
    "Santai aja, biar Malika!",
]
CAPTIONS = [
    "Kamu pernah nanya hal memalukan ke chatbot, tapi nggak berani nanya ke manusia?",
    "Tenang. Kamu nggak sendirian, dan ini ada penjelasannya.",
    "Contohnya: ada diskon nggak? Bisa dicicil nggak? Atau, ini pertanyaan bodoh nggak ya?",
    "Riset 2014 menemukan, orang cenderung lebih terbuka ke sistem yang nggak menghakimi.",
    "Nggak ada alis naik. Nggak ada helaan napas. Nggak ada, \"hah, gitu aja nanya?\"",
    "Artinya, pembeli yang diam belum tentu nggak minat. Bisa jadi, dia cuma malu bertanya.",
    "Jadi bikin ruang aman: ramah, tanpa menghakimi, 24 jam. Itu kerjaan AI agent seperti Malika.",
    "Tapi urusan hati, kayak komplain atau pembeli yang lagi sedih, tetap manusia yang pegang.",
    "Simpan video ini buat temen yang malu nanya. Komen \"Malika\", nanti aku kirim contohnya.",
    "Santai aja, biar Malika!",
]

# ---------------------------------------------------------------- voice
voice = PiperVoice.load(MODEL)
SR_V = voice.config.sample_rate


def synth(text, scale):
    path = f"{OUT}/_line.wav"
    with wave.open(path, "wb") as w:
        voice.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=scale))
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    # trim silence at edges
    idx = np.where(np.abs(a) > 0.01)[0]
    return a[idx[0]: idx[-1] + 1]


clips = [synth(t, 0.92 if i < len(LINES) - 1 else 1.15) for i, t in enumerate(LINES)]
GAP, T0 = 0.28, 0.4
starts, t = [], T0
for c in clips:
    starts.append(t)
    t += len(c) / SR_V + GAP
ends = [s + len(c) / SR_V for s, c in zip(starts, clips)]
TOTAL = ends[-1] + 1.6
assert TOTAL <= 60, f"video too long: {TOTAL:.1f}s"
print(f"total {TOTAL:.1f}s")

SR = 44100
voice_trk = np.zeros(int(TOTAL * SR))
for s, c in zip(starts, clips):
    up = np.interp(np.arange(int(len(c) * SR / SR_V)) * SR_V / SR, np.arange(len(c)), c)
    i = int(s * SR)
    voice_trk[i: i + len(up)] += up
voice_trk = voice_trk / np.max(np.abs(voice_trk)) * 0.9

with wave.open(MUSIC) as w:
    m = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
music = np.zeros(len(voice_trk))
music[: min(len(m), len(music))] = m[: len(music)]

# duck music under voice (smoothed envelope)
win = int(0.12 * SR)
env = np.convolve(np.abs(voice_trk), np.ones(win) / win, mode="same")
env = np.clip(env / 0.12, 0, 1)
gain = 0.30 - 0.20 * env           # 0.30 alone, ~0.10 under speech
gain[: int(T0 * SR)] = 0.45         # bumper before the hook
chant_i = int(starts[-1] * SR)
gain[chant_i:] = 0.40               # music up for the jingle
mix = voice_trk + music * gain
fade = int(0.8 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
mix = mix / np.max(np.abs(mix)) * 0.92
with wave.open(f"{OUT}/_mix.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())

# lip-sync envelope per video frame
NF = int(TOTAL * FPS)
lip = np.zeros(NF)
for f in range(NF):
    seg = voice_trk[int(f / FPS * SR): int((f + 1) / FPS * SR)]
    lip[f] = np.sqrt(np.mean(seg ** 2)) if len(seg) else 0
lip = np.clip(lip / (np.percentile(lip[lip > 0], 90) + 1e-6), 0, 1)

# ---------------------------------------------------------------- captions
def fmt(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


with open(f"{OUT}/captions.srt", "w", encoding="utf-8") as f:
    for i, (s, e, c) in enumerate(zip(starts, ends, CAPTIONS), 1):
        f.write(f"{i}\n{fmt(s)} --> {fmt(e + 0.1)}\n{c}\n\n")

# ---------------------------------------------------------------- drawing helpers
_fonts = {}


def F(sz):
    sz = max(8, int(sz))
    if sz not in _fonts:
        _fonts[sz] = ImageFont.truetype(BOLD, sz)
    return _fonts[sz]


def ease_back(x):
    x = min(max(x, 0), 1)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def pop(ts, at, dur=0.35):
    return ease_back((ts - at) / dur) if ts >= at else 0.0


def text_c(d, s, cx, cy, size, fill, scale=1.0):
    if scale <= 0.02:
        return
    size = min(size, size * 980 / d.textlength(s, font=F(size)))  # fit within the frame
    d.text((cx, cy), s, font=F(size * scale), fill=fill, anchor="mm")


def bubble(d, cx, cy, w, h, fill, text, tcol, size, scale=1.0, tail="l"):
    if scale <= 0.02:
        return
    w = min(1000, max(w, d.textlength(text, font=F(size)) + 120))
    cx = min(max(cx, w / 2 + 20), W - w / 2 - 20)
    w, h = w * scale, h * scale
    d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=h / 2.6, fill=fill)
    tx = cx - w / 2 + 70 if tail == "l" else cx + w / 2 - 70
    d.polygon([(tx - 25, cy + h / 2 - 4), (tx + 25, cy + h / 2 - 4), (tx + (-30 if tail == "l" else 30), cy + h / 2 + 40)], fill=fill)
    d.text((cx, cy), text, font=F(size * scale), fill=tcol, anchor="mm")


def heart(d, cx, cy, r, fill):
    d.ellipse((cx - r, cy - r, cx, cy + r * 0.2), fill=fill)
    d.ellipse((cx, cy - r, cx + r, cy + r * 0.2), fill=fill)
    d.polygon([(cx - r * 0.98, cy - r * 0.2), (cx + r * 0.98, cy - r * 0.2), (cx, cy + r * 1.25)], fill=fill)


def check(d, cx, cy, s, col):
    d.line([(cx - s, cy), (cx - s * 0.3, cy + s * 0.7), (cx + s, cy - s * 0.7)], fill=col, width=int(s * 0.5), joint="curve")


def note(d, cx, cy, s, col):
    d.ellipse((cx - s, cy - s * 0.6, cx + s * 0.4, cy + s * 0.5), fill=col)
    d.rectangle((cx + s * 0.25, cy - s * 2.4, cx + s * 0.45, cy), fill=col)
    d.polygon([(cx + s * 0.45, cy - s * 2.4), (cx + s * 1.3, cy - s * 1.6), (cx + s * 0.45, cy - s * 1.5)], fill=col)


def mascot(d, t, lipv, frame):
    cx, cy = 540, 985 + 14 * math.sin(t * 3)
    d.line((cx, cy - 135, cx, cy - 190), fill=NAVY, width=10)
    d.ellipse((cx - 22, cy - 220, cx + 22, cy - 176), fill=CORAL)
    d.rounded_rectangle((cx - 170, cy - 140, cx + 170, cy + 130), radius=90, fill=TEAL, outline=NAVY, width=8)
    blink = (t % 3.2) < 0.13
    for ex in (-65, 65):
        if blink:
            d.line((cx + ex - 30, cy - 30, cx + ex + 30, cy - 30), fill=NAVY, width=9)
        else:
            d.ellipse((cx + ex - 38, cy - 68, cx + ex + 38, cy + 8), fill="white", outline=NAVY, width=6)
            d.ellipse((cx + ex - 14 + 6 * math.sin(t), cy - 44, cx + ex + 14 + 6 * math.sin(t), cy - 16), fill=NAVY)
    d.ellipse((cx - 135, cy + 5, cx - 85, cy + 40), fill=PINK)
    d.ellipse((cx + 85, cy + 5, cx + 135, cy + 40), fill=PINK)
    mh = 10 + 62 * lipv
    d.ellipse((cx - 48, cy + 55 - mh / 4, cx + 48, cy + 55 + mh), fill=NAVY)
    if mh > 30:
        d.ellipse((cx - 28, cy + 55 + mh * 0.45, cx + 28, cy + 55 + mh * 0.95), fill=CORAL)


# ---------------------------------------------------------------- scenes
def sc_hook(d, ts, f, t):
    for i, (s, col) in enumerate((("MALU", CORAL), ("NANYA KE", NAVY), ("MANUSIA?", CORAL))):
        sh = 5 * math.sin(t * 25 + i) if i == 2 else 0
        text_c(d, s, 540 + sh, 330 + i * 190, 165, col, pop(ts, 0.15 + i * 0.25))


def sc_alone(d, ts, f, t):
    text_c(d, "KAMU NGGAK", 540, 360, 150, NAVY, pop(ts, 0.1))
    text_c(d, "SENDIRIAN", 540, 540, 170, CORAL, pop(ts, 0.4))
    text_c(d, "(ada penjelasannya)", 540, 700, 52, NAVY, pop(ts, 1.2))


def sc_examples(d, ts, f, t):
    qs = ["Ada diskon nggak?", "Bisa dicicil nggak?", "Ini pertanyaan bodoh nggak ya?"]
    for i, q in enumerate(qs):
        side = i % 2
        bubble(d, 540 + (-60 if side == 0 else 60), 290 + i * 170, 800 if i < 2 else 880, 130,
               CORAL if side == 0 else TEAL, q, "white", 56 if i < 2 else 48, pop(ts, 0.15 + f * 0 + [0.1, 1.6, 3.6][i]),
               "l" if side == 0 else "r")


def sc_research(d, ts, f, t):
    d.rounded_rectangle((90, 230, 990, 800), radius=50, fill="white", outline=NAVY, width=8)
    text_c(d, "RISET 2014", 540, 300, 64, CORAL, pop(ts, 0.1))
    text_c(d, "Lucas dkk. — “It’s only a computer”", 540, 365, 38, NAVY, pop(ts, 0.3))
    g = min(1, max(0, (ts - 0.8) / 1.4))
    for x, hgt, col, label in ((290, 130, PINK, "ke manusia"), (790, 260, TEAL, "ke sistem otomatis")):
        h = hgt * g
        d.rounded_rectangle((x - 110, 735 - h, x + 110, 735), radius=18, fill=col, outline=NAVY, width=6)
        text_c(d, label, x, 768, 34, NAVY)
    text_c(d, "tingkat keterbukaan (ilustrasi)", 540, 440, 34, NAVY, pop(ts, 0.8))


def sc_nojudge(d, ts, f, t):
    items = ["alis naik", "helaan napas", "“hah, gitu aja nanya?”"]
    for i, it in enumerate(items):
        at = 0.2 + i * 1.9
        y = 330 + i * 190
        sc = pop(ts, at)
        d.rounded_rectangle((120, y - 70, 960, y + 70), radius=40, fill="white", outline=NAVY, width=6) if sc > 0.5 else None
        text_c(d, it, 540, y, 56, NAVY, sc)
        k = min(1, max(0, (ts - at - 0.5) / 0.3))
        if k > 0:
            d.line((150, y, 150 + 780 * k, y), fill=CORAL, width=12)


def sc_silent(d, ts, f, t):
    text_c(d, "DIAM ≠", 540, 340, 160, NAVY, pop(ts, 0.1))
    text_c(d, "NGGAK MINAT", 540, 520, 130, CORAL, pop(ts, 0.5))
    bubble(d, 540, 730, 700, 120, "white", "…malu nanya", NAVY, 58, pop(ts, 2.4))


def sc_safe(d, ts, f, t):
    items = ["Ramah", "Tanpa menghakimi", "24 jam"]
    for i, it in enumerate(items):
        at = 0.3 + i * 1.5 + (1.2 if i == 2 else 0)
        y = 330 + i * 180
        sc = pop(ts, at)
        if sc > 0.1:
            d.ellipse((130, y - 55, 240, y + 55), fill=TEAL, outline=NAVY, width=6)
            check(d, 185, y, 24 * min(sc, 1.1), "white")
        text_c(d, it, 650, y, 70, NAVY, sc)


def sc_heart(d, ts, f, t):
    heart(d, 540, 380, 140 * (1 + 0.08 * math.sin(t * 6)), CORAL)
    text_c(d, "URUSAN HATI", 540, 600, 100, NAVY, pop(ts, 0.3))
    text_c(d, "= MANUSIA", 540, 710, 100, CORAL, pop(ts, 0.7))


def sc_cta(d, ts, f, t):
    p = 1 + 0.05 * math.sin(t * 7)
    d.rounded_rectangle((540 - 330 * p, 250, 540 + 330 * p, 400), radius=75, fill=CORAL)
    text_c(d, "SIMPAN VIDEO INI", 540, 325, 62, "white", p)
    bubble(d, 540, 640, 820, 160, TEAL, "Komen: MALIKA", "white", 72, pop(ts, 0.8) * p, "l")


def sc_jingle(d, ts, f, t):
    beat = (t * 100 / 60) % 1
    sc = 1 + 0.07 * (1 - beat)
    text_c(d, "Santai aja,", 540, 360, 150, NAVY, sc)
    text_c(d, "biar Malika~", 540, 540, 150, CORAL, sc)
    for i in range(3):
        note(d, 200 + i * 340, 760 + 40 * math.sin(t * 5 + i * 2), 36, [TEAL, YELLOW, PINK][i])


SCENES = [sc_hook, sc_alone, sc_examples, sc_research, sc_nojudge, sc_silent, sc_safe, sc_heart, sc_cta, sc_jingle]
BG = [(255, 236, 214), (214, 244, 240), (255, 236, 214), (255, 248, 226), (214, 244, 240),
      (255, 226, 226), (214, 244, 240), (255, 236, 240), (255, 248, 226), (255, 236, 214)]
vs = [0.0] + [s - 0.1 for s in starts[1:]] + [TOTAL]
_bg = {}


def bg(i):
    if i not in _bg:
        top, bot = np.array(BG[i], float), np.array(BG[i], float) * 0.93
        g = np.linspace(top, bot, H)[:, None, :].repeat(W, axis=1).astype(np.uint8)
        _bg[i] = Image.fromarray(g)
    return _bg[i].copy()


def wrap(words, font, maxw, d):
    rows, cur = [], []
    for w in words:
        if d.textlength(" ".join(cur + [w]), font=font) > maxw and cur:
            rows.append(cur); cur = [w]
        else:
            cur.append(w)
    rows.append(cur)
    return rows


def draw_caption(d, i, t):
    s, e = starts[i], ends[i] + 0.1
    if not (s - 0.05 <= t <= e):
        return
    words = CAPTIONS[i].split()
    fnt = F(62)
    rows = wrap(words, fnt, 900, d)
    wts = np.array([len(w) + 1 for w in words], float)
    bounds = np.concatenate([[0], np.cumsum(wts)]) / wts.sum() * (ends[i] - s) + s
    cur = int(np.searchsorted(bounds, t, side="right")) - 1
    lh = 84
    top = 1390 - (len(rows) * lh) / 2
    d.rounded_rectangle((60, top - 25, W - 60, top + len(rows) * lh + 15), radius=45, fill=NAVY)
    k = 0
    for r, row in enumerate(rows):
        total_w = d.textlength(" ".join(row), font=fnt)
        x = W / 2 - total_w / 2
        for w in row:
            col = YELLOW if k == cur else "white"
            d.text((x, top + r * lh + lh / 2 - 6), w, font=fnt, fill=col, anchor="lm")
            x += d.textlength(w + " ", font=fnt)
            k += 1


ff = subprocess.Popen(
    ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
     "-r", str(FPS), "-i", "-", "-i", f"{OUT}/_mix.wav", "-c:v", "libx264", "-preset", "medium",
     "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-t", f"{TOTAL:.2f}",
     "-movflags", "+faststart", f"{OUT}/video.mp4"], stdin=subprocess.PIPE)

for f in range(NF):
    t = f / FPS
    i = max(k for k in range(len(vs) - 1) if t >= vs[k])
    img = bg(i)
    d = ImageDraw.Draw(img)
    for j in range(5):  # floating dots
        x = (j * 270 + 60 * math.sin(t * 0.8 + j)) % W
        y = 150 + (j * 380 + t * 18) % 1500
        d.ellipse((x - 14, y - 14, x + 14, y + 14), fill=tuple(min(255, c + 12) for c in BG[i]) if False else (255, 255, 255))
    SCENES[i](d, t - vs[i], (t - vs[i]) / max(0.01, vs[i + 1] - vs[i]), t)
    mascot(d, t, lip[f], f)
    draw_caption(d, i, t)
    d.rectangle((0, 0, W * t / TOTAL, 14), fill=CORAL)
    d.text((W - 60, 70), "Malika", font=F(46), fill=NAVY, anchor="rm")
    d.text((60, 70), "SAINS CHAT", font=F(34), fill=TEAL, anchor="lm")
    ff.stdin.write(img.tobytes())

ff.stdin.close()
ff.wait()
print("done")
