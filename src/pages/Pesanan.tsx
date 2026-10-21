import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  createOrder, db, DEFAULT_SETTINGS, ORDER_STATUSES, orderRevenue, orderSubtotal,
  PAYMENT_METHODS, setOrderStatus, type Order, type OrderItem, type Settings,
} from "../db";
import { Chips, Empty, Field, MoneyInput, Sheet, Stepper } from "../components/ui";
import { rp, timeStr, waLink } from "../utils";

type Filter = "Aktif" | "Selesai" | "Batal" | "Semua";

export default function Pesanan() {
  const [filter, setFilter] = useState<Filter>("Aktif");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const settings = useLiveQuery(() => db.settings.get("main")) ?? DEFAULT_SETTINGS;

  const orders = useLiveQuery(async () => {
    const all = await db.orders.orderBy("createdAt").reverse().limit(300).toArray();
    return all.filter((o) => {
      if (filter === "Aktif") return ["baru", "diproses", "dikirim"].includes(o.status) || (!o.paid && o.status !== "batal");
      if (filter === "Selesai") return o.status === "selesai";
      if (filter === "Batal") return o.status === "batal";
      return true;
    });
  }, [filter]);

  const open = useLiveQuery(() => (openId ? db.orders.get(openId) : undefined), [openId]);

  return (
    <div className="stack">
      <div className="row between">
        <h2>Pesanan</h2>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + Pesanan baru
        </button>
      </div>
      <Chips options={["Aktif", "Selesai", "Batal", "Semua"] as Filter[]} value={filter} onChange={setFilter} />

      {orders?.length === 0 && <Empty icon="🧾">Belum ada pesanan di sini.</Empty>}
      <div className="list">
        {orders?.map((o) => (
          <button key={o.id} className="card order-row" onClick={() => setOpenId(o.id!)}>
            <div className="row between">
              <b>
                #{o.id} · {o.customerName || "Pelanggan"}
              </b>
              <b>{rp(orderRevenue(o) + o.shippingFee)}</b>
            </div>
            <div className="muted small">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
            <div className="row between small">
              <span className="muted">
                {timeStr(o.createdAt)} · {o.channel}
              </span>
              <span>
                {!o.paid && o.status !== "batal" && <span className="badge neg">Belum bayar</span>}
                <span className={`badge st-${o.status}`}>{ORDER_STATUSES.find((s) => s.value === o.status)?.label}</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      {creating && <OrderForm settings={settings} onClose={() => setCreating(false)} />}
      {open && <OrderDetail order={open} settings={settings} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function OrderForm({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray());
  const [qty, setQty] = useState<Record<number, number>>({});
  const [channel, setChannel] = useState(settings.channels[0]?.name ?? "WhatsApp");
  const [customerName, setCustomerName] = useState("");
  const [customerWa, setCustomerWa] = useState("");
  const [address, setAddress] = useState("");
  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [paid, setPaid] = useState(true);
  const [note, setNote] = useState("");
  const [feeOverride, setFeeOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const items: OrderItem[] = (products ?? [])
    .filter((p) => qty[p.id!] > 0)
    .map((p) => ({ productId: p.id!, name: p.name, price: p.price, cost: p.cost, qty: qty[p.id!] }));
  const subtotal = orderSubtotal({ items });
  const feePct = settings.channels.find((c) => c.name === channel)?.feePct ?? 0;
  const platformFee = feeOverride ?? Math.round(((subtotal - discount) * feePct) / 100);
  const total = subtotal - discount + shippingFee;

  async function save() {
    if (!items.length || saving) return;
    setSaving(true);
    await createOrder({
      createdAt: Date.now(),
      channel, customerName, customerWa, address, items, discount, shippingFee,
      platformFee, payment, paid, note, status: "baru",
    });
    onClose();
  }

  return (
    <Sheet title="Pesanan baru" onClose={onClose}>
      {products?.length === 0 && <Empty icon="🍱">Tambahkan produk dulu di menu Produk.</Empty>}
      <div className="product-pick">
        {products?.map((p) => {
          const q = qty[p.id!] ?? 0;
          const out = p.trackStock && p.stock <= 0;
          return (
            <div key={p.id} className={q > 0 ? "pick on" : "pick"}>
              <button type="button" className="pick-main" onClick={() => setQty({ ...qty, [p.id!]: q + 1 })}>
                <span className="emoji">{p.emoji}</span>
                <b>{p.name}</b>
                <small>{rp(p.price)}</small>
                {p.trackStock && <small className={out ? "neg" : "muted"}>Stok {p.stock}</small>}
              </button>
              {q > 0 && <Stepper value={q} onChange={(n) => setQty({ ...qty, [p.id!]: n })} />}
            </div>
          );
        })}
      </div>

      <Field label="Pesanan dari">
        <Chips options={settings.channels.map((c) => c.name)} value={channel} onChange={(c) => { setChannel(c); setFeeOverride(null); }} />
      </Field>
      <div className="grid2">
        <Field label="Nama pelanggan">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Mis. Bu Rina" />
        </Field>
        <Field label="No. WhatsApp">
          <input inputMode="tel" value={customerWa} onChange={(e) => setCustomerWa(e.target.value)} placeholder="08xx" />
        </Field>
      </div>
      <Field label="Alamat kirim">
        <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <div className="grid2">
        <Field label="Diskon">
          <MoneyInput value={discount} onChange={setDiscount} />
        </Field>
        <Field label="Ongkir (dibayar pembeli)" hint="Tidak dihitung sebagai omzet">
          <MoneyInput value={shippingFee} onChange={setShippingFee} />
        </Field>
      </div>
      {feePct > 0 && (
        <Field label={`Potongan ${channel} (${feePct}%)`} hint="Bisa diubah sesuai potongan sebenarnya">
          <MoneyInput value={platformFee} onChange={setFeeOverride} />
        </Field>
      )}
      <Field label="Pembayaran">
        <Chips options={PAYMENT_METHODS} value={payment} onChange={setPayment} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Sudah dibayar
      </label>
      <Field label="Catatan">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. level pedas 3, tanpa sambal" />
      </Field>

      <div className="sticky-total">
        <div>
          <small className="muted">Total ditagih</small>
          <b>{rp(total)}</b>
        </div>
        <button className="btn primary" disabled={!items.length || saving} onClick={save}>
          Simpan pesanan
        </button>
      </div>
    </Sheet>
  );
}

function receiptText(o: Order, s: Settings) {
  const lines = [
    `*${s.businessName}*`,
    `Pesanan #${o.id} · ${timeStr(o.createdAt)}`,
    "",
    ...o.items.map((i) => `${i.qty}× ${i.name} @${rp(i.price)} = ${rp(i.qty * i.price)}`),
    "",
  ];
  if (o.discount) lines.push(`Diskon: -${rp(o.discount)}`);
  if (o.shippingFee) lines.push(`Ongkir: ${rp(o.shippingFee)}`);
  lines.push(`*Total: ${rp(orderRevenue(o) + o.shippingFee)}*`);
  lines.push(`Pembayaran: ${o.payment} (${o.paid ? "Lunas" : "Belum dibayar"})`);
  if (o.address) lines.push(`Alamat: ${o.address}`);
  lines.push("", "Terima kasih sudah memesan! 🙏");
  return lines.join("\n");
}

function OrderDetail({ order: o, settings, onClose }: { order: Order; settings: Settings; onClose: () => void }) {
  const profit = orderRevenue(o) - o.items.reduce((s, i) => s + i.cost * i.qty, 0) - o.platformFee;

  async function remove() {
    if (!confirm(`Hapus pesanan #${o.id}? Stok akan dikembalikan.`)) return;
    if (o.status !== "batal") await setOrderStatus(o, "batal");
    await db.orders.delete(o.id!);
    onClose();
  }

  return (
    <Sheet title={`Pesanan #${o.id}`} onClose={onClose}>
      <div className="card flat">
        <div className="muted small">
          {timeStr(o.createdAt)} · {o.channel} · {o.payment}
        </div>
        <b>{o.customerName || "Pelanggan"}</b> {o.customerWa && <span className="muted">· {o.customerWa}</span>}
        {o.address && <div className="small">{o.address}</div>}
        {o.note && <div className="small">📝 {o.note}</div>}
      </div>
      <table className="tbl">
        <tbody>
          {o.items.map((i) => (
            <tr key={i.productId}>
              <td>{i.qty}× {i.name}</td>
              <td className="r">{rp(i.qty * i.price)}</td>
            </tr>
          ))}
          {o.discount > 0 && (
            <tr><td>Diskon</td><td className="r">-{rp(o.discount)}</td></tr>
          )}
          {o.shippingFee > 0 && (
            <tr><td>Ongkir</td><td className="r">{rp(o.shippingFee)}</td></tr>
          )}
          <tr className="strong"><td>Total</td><td className="r">{rp(orderRevenue(o) + o.shippingFee)}</td></tr>
          {o.platformFee > 0 && (
            <tr className="muted"><td>Potongan {o.channel}</td><td className="r">-{rp(o.platformFee)}</td></tr>
          )}
          <tr className="muted"><td>Untung kotor pesanan ini</td><td className="r pos">{rp(profit)}</td></tr>
        </tbody>
      </table>

      <Field label="Status">
        <Chips
          options={ORDER_STATUSES.map((s) => s.label)}
          value={ORDER_STATUSES.find((s) => s.value === o.status)!.label}
          onChange={(label) => setOrderStatus(o, ORDER_STATUSES.find((s) => s.label === label)!.value)}
        />
      </Field>
      <label className="check">
        <input type="checkbox" checked={o.paid} onChange={(e) => db.orders.update(o.id!, { paid: e.target.checked })} /> Sudah dibayar
      </label>

      <div className="stack">
        {o.customerWa ? (
          <a className="btn primary" href={waLink(o.customerWa, receiptText(o, settings))} target="_blank" rel="noreferrer">
            💬 Kirim struk ke WhatsApp pelanggan
          </a>
        ) : (
          <button className="btn" onClick={() => navigator.clipboard.writeText(receiptText(o, settings))}>
            📋 Salin struk
          </button>
        )}
        <button className="btn ghost danger" onClick={remove}>
          Hapus pesanan
        </button>
      </div>
    </Sheet>
  );
}
