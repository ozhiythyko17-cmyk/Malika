# Video 57 detik — "Kenapa orang lebih jujur ke bot?" (Asamerta AI)

- `asamerta-jujur-ke-bot-57s.mp4` — 1080×1920 portrait, 30 fps. Motion graphics + dubbing Indonesia + caption (maks. 2 baris) + theme song + sound design.
- `captions.srt` — CC terpisah (sinkron dengan video).

## Cara build ulang
```
cd motion && npm install gsap @fontsource/plus-jakarta-sans @fontsource/inter
pip install piper-tts numpy
python3 ../../audio/make_theme.py 24 music.wav
python3 make_audio.py <id_ID-news_tts-medium.onnx> music.wav out [voice_dir]
node render.js out/video.mp4            # butuh Playwright + ffmpeg
node preview.js 4,20.5,40 /tmp/preview  # cek frame tertentu
```
- `make_audio.py` — suara, sound design (ketikan, whoosh, ding), mixing ducking, dan timing caption.
- `index.html` + `scenes.js` — scene motion (GSAP, deterministik per frame).
- **Ganti suara:** taruh `line01.wav … line10.wav` (dari ElevenLabs/Google/Azure TTS atau rekaman sendiri) di folder `voice_dir`; durasi, caption, dan animasi menyesuaikan otomatis.
- **Ganti nama brand:** teks ada di `make_audio.py` (suara + caption), `index.html`, dan `scenes.js` (`CTXT`).

## Catatan
- Klaim riset: Lucas, Gratch, King & Morency (2014), *Computers in Human Behavior*. Grafik batang hanya ilustrasi arah temuan, bukan data. Cek ulang sebelum tayang.
- Dubbing default adalah TTS Piper (satu suara). Untuk hasil paling natural, pakai voice_dir di atas.
