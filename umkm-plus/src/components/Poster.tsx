import { useEffect, useRef, useState } from "react";
import { Field } from "./ui";

interface Props {
  imageUrl: string; // harus dari domain sendiri (/api/...) supaya kanvas bisa diunduh
  aspectRatio: string;
  headline: string;
  subheadline: string;
  footer: string;
}

const SIZE: Record<string, [number, number]> = { "1:1": [1080, 1080], "9:16": [1080, 1920] };

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

  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setError("Foto tidak bisa dimuat.");
    image.src = props.imageUrl;
  }, [props.imageUrl]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !img) return;
    // Foto memenuhi kanvas (crop tengah).
    const scale = Math.max(w / img.width, h / img.height);
    ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);

    const grad = ctx.createLinearGradient(0, h * 0.45, 0, h);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    const pad = 72;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 96px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const hl = wrap(ctx, headline.toUpperCase(), w - pad * 2).slice(0, 3);
    ctx.font = "500 50px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const sub = wrap(ctx, subheadline, w - pad * 2).slice(0, 2);

    let y = h - pad - 70 - sub.length * 64 - 24;
    ctx.font = "800 96px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    y -= (hl.length - 1) * 104;
    for (const line of hl) {
      ctx.fillText(line, pad, y);
      y += 104;
    }
    y += 4;
    ctx.font = "500 50px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#ffd36b";
    for (const line of sub) {
      ctx.fillText(line, pad, y);
      y += 64;
    }
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "600 40px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(props.footer, pad, h - pad);
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
      {error ? <div className="alert warn">{error}</div> : <canvas ref={canvas} width={w} height={h} className="poster" />}
      <Field label="Judul poster">
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </Field>
      <Field label="Teks pendukung">
        <input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
      </Field>
      <button className="btn" disabled={!img} onClick={download}>⬇️ Unduh poster</button>
    </div>
  );
}
