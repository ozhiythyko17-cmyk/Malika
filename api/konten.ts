import Anthropic from "@anthropic-ai/sdk";
import { buildUserPrompt, SYSTEM_PROMPT, type ContentRequest } from "../src/prompt.js";

// Vercel Function: POST /api/konten -> { text }
export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Kunci API AI belum dipasang. Tambahkan ANTHROPIC_API_KEY di pengaturan Vercel." },
      { status: 503 }
    );
  }

  let body: ContentRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  if (!body?.productName) return Response.json({ error: "Pilih produk dulu." }, { status: 400 });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(body) }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "AI menolak permintaan ini. Coba ubah keterangan produk atau promonya." }, { status: 422 });
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return Response.json({ text });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Kunci API AI salah atau sudah tidak aktif." }, { status: 502 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "AI sedang sibuk atau kredit habis. Coba lagi sebentar." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `Layanan AI error (${error.status}).` }, { status: 502 });
    }
    return Response.json({ error: "Tidak bisa terhubung ke layanan AI." }, { status: 502 });
  }
}
