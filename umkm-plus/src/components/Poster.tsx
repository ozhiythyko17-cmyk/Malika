import { Download, Megaphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBlobUrl } from "../api";
import { Alert, Field } from "./ui";

interface Props {
  imageUrl: string; // alamat API (/api/...), diambil lewat fetch supaya kanvas bisa diunduh
  aspectRatio: string;
  headline: string;
  subheadline: string;
  footer: string;
  /** Bila diisi, muncul tombol untuk langsung mengiklankan poster (gambar JPG dalam data URL). */
  onAdvertise?: (dataUrl: string) => void;
}

const SIZE: Record<string, [number, number]> = { "1:1": [1080, 1080], "9:16": [1080, 1920] };
const FONT = "'Plus Jakarta Sans Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Poster promosi sederhana: foto + judul + teks pendukung + nama usaha, digambar di kanvas (gratis, tanpa AI). */
export default function Poster(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [headline, setHeadline] = useState(props.headline);
  const [subheadline, setSubheadline] = useState(props.subheadline);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState("");
  const [w, h] = SIZE[props.aspectRatio] ?? SIZE["1:1"];

  useEffect(() => {
    setHeadline(props.headline);
    setSubheadline(props.subheadline);
  }, [props.headline, props.subheadline]);

  const blob = useBlobUrl(props.imageUrl);
  useEffect(() => {
    if (blob.failed) setError("Foto tidak bisa dimuat.");
    if (!blob.url) return;
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setError("Foto tidak bisa dimuat.");
    image.src = blob.url;
  }, [blob.url, blob.failed]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !img) return;
    let cancelled = false;
    const draw = () => {
      // Foto memenuhi kanvas (crop tengah).
      const scale = Math.max(w / img.width, h / img.height);
      ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);

      const grad = ctx.createLinearGradient(0, h * 0.4, 0, h);
      grad.addColorStop(0, "rgba(8,22,64,0)");
      grad.addColorStop(1, "rgba(8,22,64,0.9)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.4, w, h * 0.6);

      // Susun dari bawah: kapsul nama usaha, teks pendukung, judul, garis aksen.
      const pad = 72;
      ctx.textBaseline = "top";
      ctx.font = `800 92px ${FONT}`;
      const hl = wrap(ctx, headline.toUpperCase(), w - pad * 2).slice(0, 3);
      ctx.font = `500 48px ${FONT}`;
      const sub = wrap(ctx, subheadline, w - pad * 2).slice(0, 2);
      ctx.font = `600 36px ${FONT}`;
      const footerW = Math.min(w - pad * 2, ctx.measureText(props.footer).width + 64);
      const pillH = 76;

      let y = h - pad - pillH - 44 - sub.length * 62 - (sub.length ? 16 : 0) - hl.length * 100;
      ctx.fillStyle = "#4d8bff";
      pill(ctx, pad, y - 40, 88, 10);
      ctx.fillStyle = "#fff";
      ctx.font = `800 92px ${FONT}`;
      for (const line of hl) {
        ctx.fillText(line, pad, y);
        y += 100;
      }
      y += 16;
      ctx.fillStyle = "#c4d7ff";
      ctx.font = `500 48px ${FONT}`;
      for (const line of sub) {
        ctx.fillText(line, pad, y);
        y += 62;
      }
      if (props.footer) {
        ctx.fillStyle = "#2463eb";
        pill(ctx, pad, h - pad - pillH, footerW, pillH);
        ctx.fillStyle = "#fff";
        ctx.font = `600 36px ${FONT}`;
        ctx.textBaseline = "middle";
        ctx.fillText(props.footer, pad + 32, h - pad - pillH / 2, footerW - 64);
      }
    };
    // Tunggu huruf aplikasi siap supaya poster tidak tergambar dengan huruf cadangan.
    document.fonts.load(`800 92px ${FONT}`).catch(() => {}).then(() => !cancelled && draw());
    return () => {
      cancelled = true;
    };
  }, [img, headline, subheadline, props.footer, w, h]);

  const download = () => {
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `poster-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };

  return (
    <div className="stack">
      {error ? <Alert tone="warn">{error}</Alert> : <canvas ref={canvas} width={w} height={h} className="poster" />}
      <Field label="Judul poster">
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </Field>
      <Field label="Teks pendukung">
        <input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
      </Field>
      <button className="btn" disabled={!img} onClick={download}>
        <Download size={18} /> Unduh poster
      </button>
      {props.onAdvertise && (
        <button className="btn" disabled={!img} onClick={() => canvas.current && props.onAdvertise!(canvas.current.toDataURL("image/jpeg", 0.9))}>
          <Megaphone size={18} /> Iklankan poster ini
        </button>
      )}
    </div>
  );
}
