// Pengganti @anthropic-ai/sdk untuk demo: tidak memanggil AI sungguhan, tapi menyusun jawaban
// contoh dari isi permintaan supaya alur Studio Konten bisa dicoba.

class APIError extends Error {
  status = 500;
}
class AuthenticationError extends APIError {}
class RateLimitError extends APIError {}

interface Block {
  type: string;
  text?: string;
}

function field(text: string, label: string) {
  return text.match(new RegExp(`^${label}: (.*)$`, "m"))?.[1]?.trim() ?? "";
}

const TAGS = "#dapurbakar #ayambakar #ikanbakar #kulinerbakar #makansiang #kulinerlokal";

function captions(product: string, price: string, brief: string, style: string, business: string) {
  const what = product || "Menu bakar";
  const promo = brief ? `\n${brief.charAt(0).toUpperCase()}${brief.slice(1)}.` : "";
  const harga = price ? ` cuma ${price}` : "";
  const gaul = style === "Gaul" || style === "Lucu";
  return [
    `${gaul ? "Wangi arangnya aja udah bikin perut keroncongan 🔥" : "Aroma arang yang khas, bumbu yang meresap 🔥"}\n${what} dari ${business}${harga}.${promo}\nPesan sekarang lewat WhatsApp, kami antar hangat-hangat!\n${TAGS}`,
    `${gaul ? "Lagi bingung makan apa? Udah, ini aja 😋" : "Bingung mau makan apa hari ini?"}\n${what} dibakar dadakan setiap ada pesanan, jadi selalu fresh.${promo}\nKlik link di bio atau chat WA kami ya.\n${TAGS} #idemakan`,
    `${gaul ? "Yang belum nyobain, rugi sih 🤭" : "Pelanggan setia kami sudah tahu rasanya."}\n${what}${harga} — porsi pas, sambal nampol.${promo}\nOrder via WA, bisa juga lewat GoFood/GrabFood.\n${TAGS} #enakmurah`,
  ];
}

function generate(text: string, hasImages: number, wantVideo: boolean) {
  const business = field(text, "Usaha").replace(/ \(.*\)$/, "") || "Dapur Bakar";
  const productLine = field(text, "Produk");
  const [product, rest] = productLine.split(" — ");
  const price = rest?.split(" ")[0] ?? "";
  const brief = field(text, "Permintaan").replace(/^Buat konten promosi yang menarik untuk produk ini\.$/, "");
  const style = field(text, "Gaya bahasa");
  const materials = [...text.matchAll(/^- (Bahan \d+): (video|foto)[^"]*"([^"]+)"/gm)];

  const result: Record<string, unknown> = {
    materialNotes: materials.map(([, label, kind, name]) =>
      kind === "video"
        ? `${label} (${name}): cuplikan video — cocok untuk adegan pembuka/hook. (Demo: AI sungguhan akan menjelaskan isi videonya.)`
        : `${label} (${name}): foto menu — cocok jadi gambar utama. (Demo: AI sungguhan akan menjelaskan isi fotonya.)`
    ),
    captions: captions(product, price, brief, style, business),
    headline: product ? `${product} Juara` : "Menu Bakar Juara",
    subheadline: price ? `Mulai ${price} · Pesan via WA` : "Dibakar dadakan, diantar hangat",
    imagePrompt: `Appetizing ${product || "grilled chicken and fish"} on banana leaf, charcoal smoke, warm light, top view`,
  };
  if (wantVideo) {
    result.video = {
      title: `Dari Arang ke Piring: ${product || "Menu Bakar"}`,
      durationSec: 20,
      music: "Musik akustik santai yang sedang tren di TikTok",
      scenes: [
        { time: "0–3 dtk", shot: `Close-up api & asap arang${materials[0] ? ` (${materials[0][1]})` : ""}`, overlayText: "Sabar… lagi dibakar 🔥", voiceover: "Ini rahasia rasanya." },
        { time: "3–10 dtk", shot: `${product || "Menu"} dibalik dan diolesi bumbu`, overlayText: "Bumbu meresap sampai dalam", voiceover: "Diolesi bumbu berkali-kali." },
        { time: "10–16 dtk", shot: `Hasil akhir di piring${materials[1] ? ` (${materials[1][1]})` : ""}`, overlayText: price ? `Cuma ${price}` : "Siap diantar", voiceover: "Hangat, wangi, siap diantar." },
        { time: "16–20 dtk", shot: "Logo/nama usaha + nomor WA", overlayText: "Order via WA sekarang!", voiceover: `Pesan di ${business}.` },
      ],
    };
  }
  void hasImages;
  return result;
}

class Anthropic {
  static APIError = APIError;
  static AuthenticationError = AuthenticationError;
  static RateLimitError = RateLimitError;

  beta = {
    messages: {
      create: async (params: { messages: { content: Block[] }[]; output_config?: { format?: { schema?: { properties?: object } } } }) => {
        await new Promise((r) => setTimeout(r, 1200));
        const content = params.messages[0].content;
        const text = content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
        const wantVideo = "video" in (params.output_config?.format?.schema?.properties ?? {});
        const json = generate(text, content.filter((b) => b.type === "image").length, wantVideo);
        return {
          id: "msg_demo",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: JSON.stringify(json) }],
          stop_reason: "end_turn",
        };
      },
    },
  };
}

export default Anthropic;
