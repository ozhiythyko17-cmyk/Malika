/* Deterministic motion timeline: window.seek(t) renders the frame at time t (seconds). */
const T = window.TIMINGS, FPS = T.fps, VS = T.vs;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
gsap.ticker.lagSmoothing(0);
const tl = gsap.timeline({ paused: true });
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const at = (i, rel) => VS[i] + rel;

/* ---------------- scene wrappers ---------------- */
for (let i = 0; i < 10; i++) {
  const s = $("#s" + i), t0 = VS[i], t1 = VS[i + 1];
  if (i === 0) tl.set(s, { autoAlpha: 1 }, 0);
  else tl.fromTo(s, { autoAlpha: 0, y: 60, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" }, t0 - 0.05);
  if (i < 9) tl.to(s, { autoAlpha: 0, y: -50, scale: 1.02, duration: 0.3, ease: "power2.in" }, t1 - 0.3);
  else tl.to(s, { autoAlpha: 0, duration: 0.7 }, t1 - 0.7);
}
const rise = (sel, t, d = 0.8) => tl.from(sel, { yPercent: 115, duration: d, ease: "expo.out" }, t);
const pop = (sel, t, extra = {}) => tl.from(sel, Object.assign({ autoAlpha: 0, y: 50, scale: 0.92, duration: 0.55, ease: "back.out(1.5)" }, extra), t);

/* ---------------- S0 hook ---------------- */
rise("#h0a", 0.1); rise("#h0b", 0.3);
tl.from("#phone", { autoAlpha: 0, y: 120, duration: 0.7, ease: "expo.out" }, 0.15);
tl.fromTo("#m0", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.45);
tl.to("#hdA", { autoAlpha: 0, x: -30, duration: 0.2 }, 2.85);
tl.fromTo("#hdB", { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.3, ease: "power3.out" }, 2.95);
tl.to("#phone", { borderColor: "rgba(25,211,197,.9)", boxShadow: "0 40px 120px rgba(0,0,0,.55),0 0 0 14px rgba(25,211,197,.12)", duration: 0.4 }, 2.95);
tl.fromTo("#m1", { autoAlpha: 0, y: 30, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.6)" }, 4.22);
tl.fromTo("#m2", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" }, 4.65);
const TXT = "Ini pertanyaan bodoh nggak ya?";
function s0Typed(t) {
  const n = TXT.length;
  if (t < 0.55) return 0;
  if (t < 1.65) return Math.round(n * (t - 0.55) / 1.1);
  if (t < 1.95) return n;
  if (t < 2.6) return n - Math.round(n * (t - 1.95) / 0.65);
  if (t < 3.15) return 0;
  if (t < 3.95) return Math.round(n * (t - 3.15) / 0.8);
  if (t < 4.2) return n;
  return 0;
}

/* ---------------- S1 not alone ---------------- */
rise("#h1a", at(1, 0.1)); rise("#h1b", at(1, 0.35));
const grid = $("#grid"), cells = [];
const PCOL = ["#19D3C5", "#7C5CFF", "#FF6B81", "#FFC857"];
for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
  const d = document.createElement("div");
  d.style.cssText = `position:absolute;left:${c * 150 - 10 + 35}px;top:${r * 150}px;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center`;
  d.innerHTML = '<svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 5-7 8-7s7 2 8 7"/></svg>';
  grid.appendChild(d); cells.push({ d, dist: Math.hypot(c - 2.5, (r - 1) * 1.2) });
}
tl.from(cells.map((c) => c.d), { autoAlpha: 0, scale: 0.5, duration: 0.5, ease: "back.out(1.7)", stagger: 0.03 }, at(1, 0.5));
cells.forEach((c, k) => tl.to(c.d, { backgroundColor: PCOL[k % 4], borderColor: "rgba(255,255,255,.5)", scale: 1.08, duration: 0.35, ease: "back.out(2)" }, at(1, 1.3 + c.dist * 0.2)));

/* ---------------- S2 examples ---------------- */
pop("#s2t", at(2, 0.1));
[["#c0", 0.9], ["#c1", 2.0], ["#c2", 3.4]].forEach(([sel, t]) => tl.from(sel, { autoAlpha: 0, x: 140, rotation: 2.5, scale: 0.94, duration: 0.6, ease: "expo.out" }, at(2, t)));
tl.to("#c2", { x: "+=14", duration: 0.07, repeat: 5, yoyo: true, ease: "none" }, at(2, 4.5));
tl.to("#c2", { boxShadow: "0 0 80px rgba(255,107,129,.55)", duration: 0.5 }, at(2, 4.5));

/* ---------------- S3 research ---------------- */
pop("#s3a", at(3, 0.1)); tl.from("#s3b", { autoAlpha: 0, y: 60, duration: 0.8, ease: "expo.out" }, at(3, 0.3));
tl.from("#s3c", { autoAlpha: 0, duration: 0.6 }, at(3, 0.9)); pop("#s3d", at(3, 1.0), { scale: 0.96 });
tl.from("#s3e", { autoAlpha: 0, duration: 0.6 }, at(3, 1.6));
tl.fromTo("#bar1", { scaleY: 0.02 }, { scaleY: 0.5, duration: 1.0, ease: "power3.out" }, at(3, 2.4));
tl.fromTo("#bar2", { scaleY: 0.02 }, { scaleY: 1, duration: 1.4, ease: "power3.out" }, at(3, 3.0));
tl.from("#badge", { autoAlpha: 0, scale: 0.4, y: 20, duration: 0.5, ease: "back.out(2)" }, at(3, 4.3));

/* ---------------- S4 no judgement ---------------- */
pop("#s4t", at(4, 0.1));
[["#r0", "#k0", 0.2], ["#r1", "#k1", 1.8], ["#r2", "#k2", 3.4]].forEach(([r, k, t]) => {
  tl.from(r, { autoAlpha: 0, x: -140, duration: 0.6, ease: "expo.out" }, at(4, t));
  tl.to(k, { scaleX: 1, duration: 0.4, ease: "power3.inOut" }, at(4, t + 0.8));
  tl.to(r, { opacity: 0.55, duration: 0.3 }, at(4, t + 1.1));
});

/* ---------------- S5 silent != not interested ---------------- */
rise("#h5a", at(5, 0.1), 0.9);
tl.from("#neq", { autoAlpha: 0, scale: 0.3, rotation: -20, duration: 0.6, ease: "back.out(2)" }, at(5, 0.7));
rise("#h5b", at(5, 1.1), 0.9);
tl.fromTo("#q0", { autoAlpha: 0, y: 30, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.6)" }, at(5, 1.7));
tl.to("#seen", { autoAlpha: 1, duration: 0.4 }, at(5, 2.4));
tl.to("#dots", { autoAlpha: 1, duration: 0.3 }, at(5, 2.9));
tl.to("#dots", { autoAlpha: 0, duration: 0.2 }, at(5, 3.9));
tl.fromTo("#shy", { autoAlpha: 0, y: 20, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.8)" }, at(5, 4.0));

/* ---------------- S6 safe space ---------------- */
pop("#s6t", at(6, 0.1));
["#v0", "#v1", "#v2"].forEach((id, k) => {
  const on = [2.0, 3.0, 4.4][k];
  tl.fromTo(id, { autoAlpha: 0, y: 50, opacity: 0 }, { autoAlpha: 0.35, y: 0, duration: 0.5, ease: "power3.out" }, at(6, 0.3 + k * 0.15));
  tl.set(id + " .ck", { strokeDasharray: 30, strokeDashoffset: 30 }, 0);
  tl.to(id, { autoAlpha: 1, scale: 1.04, borderColor: "rgba(25,211,197,.9)", duration: 0.25, ease: "power2.out" }, at(6, on));
  tl.to(id, { scale: 1, duration: 0.3, ease: "back.out(2)" }, at(6, on + 0.25));
  tl.to(id + " .ck", { strokeDashoffset: 0, duration: 0.35, ease: "power2.out" }, at(6, on + 0.1));
});
tl.from("#lock", { autoAlpha: 0, y: 60, scale: 0.9, duration: 0.7, ease: "back.out(1.4)" }, at(6, 5.5));

/* ---------------- S7 human ---------------- */
tl.from("#heart", { autoAlpha: 0, scale: 0.1, duration: 0.9, ease: "elastic.out(1,.5)" }, at(7, 0.1));
tl.to("#heart", { scale: 1.07, duration: 0.42, yoyo: true, repeat: 13, ease: "sine.inOut", transformOrigin: "50% 55%" }, at(7, 1.0));
rise("#h7a", at(7, 0.7), 0.8); rise("#h7b", at(7, 4.7), 0.8);
tl.from("#hand", { autoAlpha: 0, y: 50, duration: 0.6, ease: "expo.out" }, at(7, 2.3));
tl.to("#arrow", { x: 10, duration: 0.4, yoyo: true, repeat: 7, ease: "sine.inOut" }, at(7, 2.9));

/* ---------------- S8 CTA ---------------- */
tl.from("#savebtn", { autoAlpha: 0, scale: 0.6, duration: 0.7, ease: "back.out(1.6)" }, at(8, 0.2));
tl.to("#bm", { y: -16, duration: 0.25, yoyo: true, repeat: 5, ease: "sine.inOut" }, at(8, 1.0));
tl.to("#savebtn", { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, at(8, 2.6));
tl.from("#cm", { autoAlpha: 0, y: 90, scale: 0.94, duration: 0.7, ease: "expo.out" }, at(8, 3.0));
tl.to("#csent", { autoAlpha: 1, duration: 0.3 }, at(8, 4.35));
const CTXT = "ASAMERTA";

/* ---------------- S9 outro ---------------- */
tl.from("#lgo", { scale: 0, duration: 0.9, ease: "elastic.out(1,.55)" }, at(9, 0.05));
tl.from("#lgt", { autoAlpha: 0, y: 70, duration: 0.7, ease: "expo.out" }, at(9, 0.3));
tl.from("#lgs", { autoAlpha: 0, y: 30, duration: 0.6, ease: "power3.out" }, at(9, 0.7));
const eq = $("#eq"), bars = [];
for (let k = 0; k < 26; k++) {
  const b = document.createElement("i");
  b.style.cssText = "display:block;width:22px;border-radius:11px;height:20px;background:linear-gradient(180deg,#19D3C5,#7C5CFF);";
  eq.appendChild(b); bars.push(b);
}
tl.from("#eq", { autoAlpha: 0, duration: 0.6 }, at(9, 0.5));

/* ---------------- orb ---------------- */
tl.fromTo("#orb", { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: "back.out(2)" }, VS[1] + 0.3);
tl.to("#orb", { autoAlpha: 0, scale: 0.4, duration: 0.3 }, VS[9] - 0.3);

/* ---------------- captions (max 2 lines per chunk) ---------------- */
const caps = $("#caps");
T.lines.forEach((l) => l.chunks.forEach((c, ci) => {
  const d = document.createElement("div");
  d.className = "cap";
  d.innerHTML = '<span class="box">' + c.words.map((w) => `<span class="w">${w.w}</span>`).join(" ") + "</span>";
  caps.appendChild(d);
  const last = ci === l.chunks.length - 1;
  tl.fromTo(d, { autoAlpha: 0, y: 18, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out" }, c.start - 0.06);
  tl.set(d, { autoAlpha: 0 }, last ? c.end + 0.15 : c.end - 0.05);
  [...d.querySelectorAll(".w")].forEach((el, k) => {
    tl.set(el, { color: "#FFD166" }, c.words[k].s);
    tl.set(el, { color: "#FFFFFF" }, c.words[k].e);
  });
}));
window.capReport = () => $$(".cap").map((d) => {
  d.style.visibility = "visible"; d.style.opacity = 1;
  const rows = new Set([...d.querySelectorAll(".w")].map((w) => w.offsetTop)).size;
  d.style.visibility = ""; d.style.opacity = "";
  return rows;
});

/* ---------------- per-frame dynamics ---------------- */
const PAL = [["#7C5CFF", "#FF6B81", "#19D3C5"], ["#19D3C5", "#7C5CFF", "#FFC857"], ["#FF6B81", "#7C5CFF", "#19D3C5"], ["#7C5CFF", "#19D3C5", "#2AA8FF"],
  ["#FF6B81", "#FFC857", "#7C5CFF"], ["#FFC857", "#FF6B81", "#7C5CFF"], ["#19D3C5", "#2AA8FF", "#7C5CFF"], ["#FF6B81", "#7C5CFF", "#FFC857"],
  ["#7C5CFF", "#19D3C5", "#FF6B81"], ["#7C5CFF", "#FF6B81", "#19D3C5"]];
const blobs = [$("#b1"), $("#b2"), $("#b3")];
const typed = $("#typed"), cur = $("#cur"), send = $("#send"), ctext = $("#ctext");
const dts = $$(".dt"), rg1 = $("#rg1"), rg2 = $("#rg2"), core = $("#core");

function update(t) {
  let i = 0; while (i < 9 && t >= VS[i + 1]) i++;
  const f = clamp(Math.floor(t * FPS), 0, T.amp.length - 1);
  const a = T.amp[f] || 0, a2 = T.amp[Math.max(0, f - 6)] || 0, a3 = T.amp[Math.max(0, f - 12)] || 0;
  $("#progf").style.width = (100 * t / T.total) + "%";
  // background blobs
  const p = clamp((t - VS[i]) / 0.8), prev = PAL[Math.max(0, i - 1)], now = PAL[i];
  blobs.forEach((b, k) => {
    const col = gsap.utils.interpolate(prev[k], now[k], p);
    b.style.background = col;
    const x = [-200, 560, 160][k] + 90 * Math.sin(t * 0.5 + k * 2), y = [60, 700, 1350][k] + 110 * Math.cos(t * 0.4 + k);
    b.style.transform = `translate(${x}px,${y}px)`;
  });
  // orb
  core.style.transform = `scale(${1 + 0.16 * a})`;
  rg1.style.transform = `scale(${1 + 0.55 * a2})`; rg1.style.opacity = 0.65 * a2;
  rg2.style.transform = `scale(${1 + 0.95 * a3})`; rg2.style.opacity = 0.4 * a3;
  // S0 typing
  const n = s0Typed(t);
  typed.textContent = TXT.slice(0, n);
  cur.style.opacity = (Math.floor(t * 2.2) % 2 === 0 || n > 0) && t < 4.25 ? 1 : 0;
  send.style.background = n > 0 ? (t > 2.95 ? "var(--teal)" : "var(--violet)") : "rgba(255,255,255,.18)";
  // S5 typing dots
  dts.forEach((d, k) => { d.style.transform = `translateY(${-9 * Math.max(0, Math.sin(t * 9 - k * 0.8))}px)`; });
  // S8 comment typing
  const ts8 = t - VS[8];
  const cn = clamp(Math.floor((ts8 - 3.7) / 0.1), 0, CTXT.length);
  ctext.textContent = CTXT.slice(0, cn);
  // S9 equalizer (100 bpm)
  const beat = t * 100 / 60;
  bars.forEach((b, k) => {
    const h = 24 + 120 * Math.abs(Math.sin(beat * Math.PI * 0.5 + k * 0.55)) * (0.55 + 0.45 * Math.sin(k * 1.7 + beat));
    b.style.height = h + "px";
  });
}
window.seek = (t) => { tl.seek(t, false); update(t); };
window.__ready = document.fonts.ready.then(() => true);
