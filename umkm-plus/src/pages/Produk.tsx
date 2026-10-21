import { useState } from "react";
import type { Product, ProductInput, StockMove } from "../../shared/types";
import { mutate, useApi } from "../api";
import { useSession } from "../App";
import { Empty, Field, LoadError, MoneyInput, NumberInput, Sheet, useRun } from "../components/ui";
import { rp, timeStr } from "../utils";

const EMOJIS = ["🔥", "🍗", "🍢", "🐟", "🦐", "🦑", "🌽", "🍖", "🥩", "🍱", "🍛", "🍚", "🌶️", "🥗", "🧋", "🥤", "☕", "🍹", "🧊", "🍰"];

const blank: ProductInput = { name: "", emoji: "🔥", price: 0, cost: 0, trackStock: false, stock: 0, minStock: 5, active: true, description: "" };

const marginPct = (p: { price: number; cost: number }) => (p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0);

export default function Produk() {
  const { isOwner } = useSession();
  const { data: products, error } = useApi<Product[]>("/products");
  const [editing, setEditing] = useState<ProductInput & { id?: number } | null>(null);
  const [stocking, setStocking] = useState<Product | null>(null);

  return (
    <div className="stack">
      <div className="row between">
        <h2>Produk</h2>
        {isOwner && (
          <button className="btn primary" onClick={() => setEditing(blank)}>
            + Produk
          </button>
        )}
      </div>
      <LoadError error={error} />
      {products?.length === 0 && <Empty icon="🍱">Belum ada produk. Tambahkan menu jualanmu.</Empty>}
      <div className="list">
        {products?.map((p) => {
          const margin = marginPct(p);
          const level = !p.trackStock ? "" : p.stock <= 0 ? "out" : p.stock <= p.minStock ? "low" : "ok";
          return (
            <div key={p.id} className={p.active ? "card product-row" : "card product-row inactive"}>
              <span className="emoji big">{p.emoji}</span>
              <button className="grow left" disabled={!isOwner} onClick={() => setEditing(p)}>
                <b>{p.name}</b>
                <div className="small muted">
                  Jual {rp(p.price)}
                  {isOwner && (
                    <>
                      {" "}· Modal {rp(p.cost)} · <span className={margin < 30 ? "neg" : "pos"}>untung {margin}%</span>
                    </>
                  )}
                </div>
                {!p.active && <div className="small muted">Tidak dijual</div>}
              </button>
              {p.trackStock ? (
                <button className={`stock-pill ${level}`} onClick={() => setStocking(p)}>
                  {p.stock}
                  <small>stok</small>
                </button>
              ) : (
                <span className="small muted">dibuat<br />per pesanan</span>
              )}
            </div>
          );
        })}
      </div>
      {products && products.length > 0 && (
        <p className="small muted">{isOwner ? "Ketuk produk untuk mengubah. " : ""}Ketuk angka stok untuk menambah atau menghitung ulang stok.</p>
      )}

      {editing && <ProductForm product={editing} onClose={() => setEditing(null)} />}
      {stocking && <StockForm product={stocking} onClose={() => setStocking(null)} />}
    </div>
  );
}

function ProductForm({ product, onClose }: { product: ProductInput & { id?: number }; onClose: () => void }) {
  const [p, setP] = useState(product);
  const [busy, run] = useRun();
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setP({ ...p, [k]: v });
  const margin = marginPct(p);

  const save = () =>
    run(async () => {
      if (p.id) await mutate("PUT", `/products/${p.id}`, p);
      else await mutate("POST", "/products", p);
      onClose();
    });

  const remove = () =>
    confirm(`Hapus ${p.name}? Riwayat pesanan tetap tersimpan.`) &&
    run(async () => {
      await mutate("DELETE", `/products/${p.id}`);
      onClose();
    });

  return (
    <Sheet title={p.id ? "Ubah produk" : "Produk baru"} onClose={onClose}>
      <Field label="Ikon" group>
        <div className="emoji-pick">
          {EMOJIS.map((e) => (
            <button type="button" key={e} className={e === p.emoji ? "on" : ""} onClick={() => set("emoji", e)}>
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Nama produk">
        <input value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Mis. Ayam Bakar Madu" />
      </Field>
      <div className="grid2">
        <Field label="Harga jual">
          <MoneyInput value={p.price} onChange={(n) => set("price", n)} />
        </Field>
        <Field label="Modal per porsi (HPP)" hint="Bahan + bumbu + arang + kemasan untuk 1 porsi">
          <MoneyInput value={p.cost} onChange={(n) => set("cost", n)} />
        </Field>
      </div>
      {p.price > 0 && (
        <div className="alert info">
          Untung per porsi <b>{rp(p.price - p.cost)}</b> ({margin}%).
          {margin < 40 && " Untuk kuliner online, idealnya di atas 40% agar tetap untung setelah potongan aplikasi (±20%)."}
        </div>
      )}
      <Field label="Deskripsi singkat" hint="Dipakai AI saat membuat caption. Mis. rasa, porsi, keunggulan.">
        <textarea rows={2} value={p.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={p.trackStock} onChange={(e) => set("trackStock", e.target.checked)} />
        Lacak stok (untuk produk siap jual, mis. sambal botol, frozen)
      </label>
      {p.trackStock && (
        <div className="grid2">
          {!p.id && (
            <Field label="Stok awal">
              <NumberInput value={p.stock} onChange={(n) => set("stock", n)} />
            </Field>
          )}
          <Field label="Ingatkan jika stok ≤">
            <NumberInput value={p.minStock} onChange={(n) => set("minStock", n)} />
          </Field>
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={p.active} onChange={(e) => set("active", e.target.checked)} /> Sedang dijual
      </label>
      <div className="stack">
        <button className="btn primary" disabled={!p.name.trim() || busy} onClick={save}>
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
        {p.id && (
          <button className="btn ghost danger" disabled={busy} onClick={remove}>
            Hapus produk
          </button>
        )}
      </div>
    </Sheet>
  );
}

function StockForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const [qty, setQty] = useState(0);
  const [mode, setMode] = useState<"masuk" | "koreksi">("masuk");
  const { data: moves } = useApi<StockMove[]>(`/products/${product.id}/moves`);
  const [busy, run] = useRun();

  const save = () =>
    run(async () => {
      await mutate("POST", `/products/${product.id}/stock`, { mode, qty });
      onClose();
    });

  return (
    <Sheet title={`Stok ${product.name}`} onClose={onClose}>
      <p>
        Stok sekarang: <b>{product.stock}</b>
      </p>
      <div className="chips">
        <button className={mode === "masuk" ? "chip on" : "chip"} onClick={() => setMode("masuk")}>Tambah stok</button>
        <button className={mode === "koreksi" ? "chip on" : "chip"} onClick={() => setMode("koreksi")}>Hitung ulang</button>
      </div>
      <Field label={mode === "masuk" ? "Jumlah masuk" : "Jumlah sebenarnya setelah dihitung"}>
        <NumberInput value={qty} onChange={setQty} />
      </Field>
      <button className="btn primary" disabled={busy || (mode === "masuk" && qty <= 0)} onClick={save}>
        Simpan
      </button>
      <h3>Riwayat</h3>
      {moves?.length === 0 && <p className="muted small">Belum ada riwayat.</p>}
      <table className="tbl">
        <tbody>
          {moves?.map((m) => (
            <tr key={m.id}>
              <td className="small">{timeStr(m.date)}<br /><span className="muted">{m.reason}</span></td>
              <td className={m.qty > 0 ? "r pos" : "r neg"}>{m.qty > 0 ? "+" : ""}{m.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}
