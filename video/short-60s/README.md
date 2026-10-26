# Video 55 detik — "Kenapa orang lebih jujur ke bot?"

- `malika-jujur-ke-bot-55s.mp4` — 1080×1920 (portrait), 30 fps, 55 detik. Dubbing Indonesia + caption karaoke (burned-in) + theme song.
- `captions.srt` — CC terpisah (untuk diunggah sebagai subtitle di TikTok/Reels/Shorts).
- `build.py` — pembuat video (Piper TTS `id_ID-news_tts-medium` → mix musik dengan ducking → frame PIL → ffmpeg).

Rebuild:
```
pip install piper-tts pillow numpy
python3 ../audio/make_theme.py 24 music.wav
python3 build.py <id_ID-news_tts-medium.onnx> music.wav <out_dir>
```
Model suara: sherpa-onnx release `vits-piper-id_ID-news_tts-medium`.

## Alur
| Detik | Isi |
|---|---|
| 0:00 | **Hook** — "Kamu pernah nanya hal memalukan ke chatbot, tapi nggak berani nanya ke manusia?" |
| 0:07 | Validasi — "Kamu nggak sendirian" |
| 0:12 | Contoh pertanyaan "malu" (diskon, cicilan, pertanyaan bodoh) |
| 0:21 | Edukasi — riset Lucas dkk. 2014 *"It's only a computer"* |
| 0:30 | Kenapa: tidak ada penghakiman (alis naik, helaan napas) |
| 0:38 | Insight: pembeli diam ≠ nggak minat |
| 0:45 | Solusi (ruang aman 24 jam) + batas AI (urusan hati = manusia) + CTA |
| 0:53 | Jingle "Santai aja, biar Malika!" |

## Catatan
- Klaim riset: Lucas, Gratch, King & Morency (2014), *Computers in Human Behavior*. Grafik batang hanya ilustrasi arah temuan, bukan data. Cek ulang sebelum tayang.
- Suara dubbing adalah TTS (satu suara). Untuk hasil paling natural, rekam ulang dengan `../dubbing-dan-theme-song.md` sebagai panduan lalu ganti audio.
- Theme song instrumental; versi bervokal bisa dibuat dengan prompt di `../dubbing-dan-theme-song.md`.
