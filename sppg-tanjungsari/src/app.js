// ═══════════════════════════════════════════════════════════════════════════
//  Model 3D SPPG Tanjungsari #004 — mesin scene + antarmuka
//  Skala 1 : 1 (1 unit Three.js = 1 meter). Denah sumbu-Y dipetakan ke sumbu-Z.
// ═══════════════════════════════════════════════════════════════════════════
(() => {
  "use strict";

  const M = (mm) => mm / 1000;                 // milimeter → meter
  const areaOf = (r) => {                      // luas neto ruang, m²
    const [x0, y0, x1, y1] = r.rect;
    let a = (x1 - x0) * (y1 - y0);
    (r.carve || []).forEach(([a0, b0, a1, b1]) => {
      const w = Math.max(0, Math.min(x1, a1) - Math.max(x0, a0));
      const h = Math.max(0, Math.min(y1, b1) - Math.max(y0, b0));
      a -= w * h;
    });
    return a / 1e6;
  };
  const id = (n) => n.toLocaleString("id-ID"); // format angka Indonesia
  const DEG = Math.PI / 180;

  const COL = {
    slab: 0x141c20, floor: 0x1b262b, wall: 0x33474f, wallTop: 0x486069,
    steel: 0xb9c6cc, steelDark: 0x7f8f96, hob: 0x45525b, pot: 0xaebcc3,
    gas: 0xff9c3f, hood: 0xa8b6bd, gutter: 0x0b1215, grill: 0x7e9099,
    tray: 0x2f3a40, bin: 0x3f7d4a, wood: 0xa9855c, fabric: 0x2f3a45,
    glass: 0x86c8d4, waste: 0x4a5a62, lamp: 0xfff3d0,
  };

  // ── Elemen dasar ─────────────────────────────────────────────────────────
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({
    color, roughness: o.roughness ?? 0.62, metalness: o.metalness ?? 0.12,
    transparent: o.opacity !== undefined, opacity: o.opacity ?? 1,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
    side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true,
  });

  function box(parent, size, pos, color, o = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]),
      o.material || mat(color, o));
    m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = o.shadow !== false;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function cyl(parent, r, h, pos, color, o = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.rTop ?? r, r, h, o.seg ?? 20),
      o.material || mat(color, o));
    m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // Label berbasis kanvas — dipakai untuk nama ruang dan kode peralatan.
  function label(text, o = {}) {
    const pad = 18, fs = o.fs || 46, sub = o.sub;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width;
    let subW = 0;
    if (sub) { ctx.font = `400 ${fs * 0.66}px ui-monospace, monospace`; subW = ctx.measureText(sub).width; }
    c.width = Math.ceil(Math.max(w, subW) + pad * 2);
    c.height = Math.ceil(fs * (sub ? 2.05 : 1.35) + pad);
    const g = c.getContext("2d");
    g.fillStyle = o.bg || "rgba(8,17,21,.84)";
    g.beginPath(); g.roundRect(0, 0, c.width, c.height, 12); g.fill();
    g.strokeStyle = o.border || "rgba(63,208,201,.32)"; g.lineWidth = 2;
    g.beginPath(); g.roundRect(1, 1, c.width - 2, c.height - 2, 12); g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = o.color || "#dce7ea";
    g.font = `600 ${fs}px system-ui, sans-serif`;
    g.fillText(text, c.width / 2, sub ? fs * 0.82 : c.height / 2);
    if (sub) {
      g.fillStyle = o.subColor || "#7d949c";
      g.font = `400 ${fs * 0.66}px ui-monospace, monospace`;
      g.fillText(sub, c.width / 2, fs * 1.62);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: o.depthTest !== false, sizeAttenuation: true,
    }));
    const scale = (o.scale || 0.0022);
    sp.scale.set(c.width * scale, c.height * scale, 1);
    sp.userData.layer = o.layerName || "label";
    return sp;
  }

  // ── Scene ────────────────────────────────────────────────────────────────
  const viewport = document.getElementById("viewport");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060c0f);
  scene.fog = new THREE.Fog(0x060c0f, 34, 78);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 260);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI / 2.04;
  controls.minDistance = 3;
  controls.maxDistance = 90;

  scene.add(new THREE.HemisphereLight(0xa8c6d0, 0x0d1518, 1.15));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.55);
  key.position.set(-14, 26, -8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 80;
  const S = 20;
  key.shadow.camera.left = -S; key.shadow.camera.right = S;
  key.shadow.camera.top = S; key.shadow.camera.bottom = -S;
  key.shadow.bias = -0.0009;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fd4e6, 0.5);
  fill.position.set(22, 16, 26);
  scene.add(fill);

  const world = new THREE.Group();
  world.position.set(-10, 0, -10);        // pusatkan bangunan 20 × 20 m di origin
  scene.add(world);

  // ── Tapak & lantai ───────────────────────────────────────────────────────
  const apron = box(world, [M(26000), M(120), M(29000)], [M(10000), -M(70), M(8000)], COL.slab,
    { roughness: 0.95, metalness: 0.02, shadow: false });
  apron.receiveShadow = true;

  const grid = new THREE.GridHelper(M(29000), 29, 0x1d3038, 0x14242a);
  grid.position.set(M(10000), -M(8), M(8000));
  world.add(grid);

  const roomMeshes = new Map();
  const floorsGroup = new THREE.Group(); world.add(floorsGroup);

  function addFloor(room) {
    const [x0, y0, x1, y1] = room.rect;
    const z = ZONES[room.zone];
    const g = new THREE.Group();
    const build = (a, b, c, d, tint) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(M(c - a), M(28), M(d - b)),
        mat(tint, { roughness: 0.88, metalness: 0.04, opacity: 1 })
      );
      m.position.set(M((a + c) / 2), M(room.level) + M(14), M((b + d) / 2));
      m.receiveShadow = true;
      m.userData.pick = { type: "room", code: room.code };
      g.add(m);
    };
    // Ruang ber-"carve" (kamar dengan toilet, atau area persiapan yang
    // melingkupi gudang alat dapur) disusun dari pita sisa hasil pengurangan
    // persegi — berlaku untuk potongan di pojok mana pun.
    if (room.carve && room.carve.length) {
      const [rx0, ry0, rx1, ry1] = room.carve[0];
      const cx0 = Math.max(x0, rx0), cy0 = Math.max(y0, ry0);
      const cx1 = Math.min(x1, rx1), cy1 = Math.min(y1, ry1);
      const bands = [
        [x0, y0, x1, cy0],    // pita utara
        [x0, cy1, x1, y1],    // pita selatan
        [x0, cy0, cx0, cy1],  // pita barat
        [cx1, cy0, x1, cy1],  // pita timur
      ];
      bands.forEach(([a, b, c, d]) => {
        if (c - a > 1 && d - b > 1) build(a, b, c, d, z.tint);
      });
    } else {
      build(x0, y0, x1, y1, z.tint);
    }
    // Garis tepi ruang agar batas terbaca dari atas.
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(M(x1 - x0), M(30), M(y1 - y0))),
      new THREE.LineBasicMaterial({ color: z.color, transparent: true, opacity: 0.34 })
    );
    edge.position.set(M((x0 + x1) / 2), M(room.level) + M(16), M((y0 + y1) / 2));
    g.add(edge);
    floorsGroup.add(g);
    roomMeshes.set(room.code, g);
    return g;
  }
  ROOMS.forEach(addFloor);

  // ── Dinding ──────────────────────────────────────────────────────────────
  const wallsGroup = new THREE.Group(); world.add(wallsGroup);
  const wallMat = mat(COL.wall, { roughness: 0.82, metalness: 0.05 });
  const capMat = mat(COL.wallTop, { roughness: 0.6, metalness: 0.12, opacity: 0.34 });
  const H = M(BUILDING.cutH), T = M(BUILDING.wallT);

  WALLS.forEach(([axis, pos, a, b]) => {
    const len = M(b - a), mid = M((a + b) / 2), p = M(pos);
    const sz = axis === "h" ? [len, H, T] : [T, H, len];
    const ps = axis === "h" ? [mid, H / 2, p] : [p, H / 2, mid];
    box(wallsGroup, sz, ps, COL.wall, { material: wallMat });
    // Pita transparan di atas potongan: memberi kesan dinding menerus ke atas.
    const cz = axis === "h" ? [len, M(220), T] : [T, M(220), len];
    const cp = axis === "h" ? [mid, H + M(110), p] : [p, H + M(110), mid];
    box(wallsGroup, cz, cp, COL.wallTop, { material: capMat, shadow: false });
  });

  // ── Label ruang ──────────────────────────────────────────────────────────
  const roomLabels = new THREE.Group(); world.add(roomLabels);
  ROOMS.forEach((r) => {
    const [x0, y0, x1, y1] = r.rect;
    const sp = label(r.name, {
      sub: `${r.code} · ${areaOf(r).toFixed(1)} m²`, fs: 40,
      border: `rgba(${(ZONES[r.zone].color >> 16) & 255},${(ZONES[r.zone].color >> 8) & 255},${ZONES[r.zone].color & 255},.45)`,
      scale: 0.0042, layerName: "room-label",
    });
    sp.position.set(M((x0 + x1) / 2), M(1620), M((y0 + y1) / 2));
    sp.userData.roomCode = r.code;
    sp.userData.baseScale = sp.scale.clone();
    roomLabels.add(sp);
  });

  // ── Peralatan ────────────────────────────────────────────────────────────
  const equipGroup = new THREE.Group(); world.add(equipGroup);
  const equipByCode = new Map();

  const steel = mat(COL.steel, { roughness: 0.34, metalness: 0.72 });
  const steelDark = mat(COL.steelDark, { roughness: 0.45, metalness: 0.6 });

  function legs(g, w, d, h, inset = 0.05) {
    const r = 0.018;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      cyl(g, r, h, [sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)], COL.steelDark,
        { material: steelDark, seg: 8 });
    });
  }
  function worktop(g, w, d, h) {
    box(g, [w, 0.04, d], [0, h - 0.02, 0], COL.steel, { material: steel });
    box(g, [w - 0.1, 0.03, d - 0.1], [0, h * 0.28, 0], COL.steelDark, { material: steelDark });
    legs(g, w, d, h - 0.04);
  }

  const BUILDERS = {
    table: (g, w, d, h) => worktop(g, w, d, h),
    "table-shelf": (g, w, d, h) => {
      worktop(g, w, d, 0.85);
      [1.18, 1.48].forEach((y) => box(g, [w * 0.94, 0.025, d * 0.55], [0, y, -d * 0.18], COL.steel, { material: steel }));
      [-1, 1].forEach((s) => [-1, 1].forEach((t) =>
        cyl(g, 0.014, 0.66, [s * (w * 0.45), 1.18, -d * 0.18 + t * (d * 0.26)], COL.steelDark, { material: steelDark, seg: 8 })));
    },
    desk: (g, w, d, h) => {
      box(g, [w, 0.04, d], [0, h - 0.02, 0], COL.wood, { roughness: 0.7, metalness: 0.05 });
      box(g, [w * 0.3, h - 0.06, d * 0.9], [-w * 0.32, (h - 0.06) / 2, 0], 0x39454c);
      box(g, [0.04, h - 0.06, d * 0.9], [w * 0.47, (h - 0.06) / 2, 0], 0x39454c);
    },
    cabinet: (g, w, d, h) => {
      box(g, [w, h, d], [0, h / 2, 0], COL.wood, { roughness: 0.72, metalness: 0.04 });
      box(g, [w * 0.86, h * 0.46, 0.02], [0, h * 0.72, d / 2 + 0.005], COL.glass,
        { opacity: 0.42, roughness: 0.1, metalness: 0.1 });
    },
    bench: (g, w, d, h) => {
      box(g, [w, 0.06, d * 0.8], [0, h * 0.52, 0], COL.fabric);
      box(g, [w, h * 0.42, 0.06], [0, h * 0.75, -d * 0.36], COL.fabric);
      legs(g, w, d * 0.8, h * 0.52, 0.04);
    },
    bed: (g, w, d) => {
      box(g, [w, 0.26, d], [0, 0.2, 0], 0x2b3d52, { roughness: 0.85, metalness: 0.02 });
      box(g, [w, 0.1, 0.06], [0, 0.42, -d / 2 + 0.03], COL.wood);
      box(g, [w * 0.8, 0.08, 0.38], [0, 0.37, -d * 0.34], 0xc4ced6, { roughness: 0.9 });
      box(g, [0.5, 1.8, 0.55], [w / 2 + 0.45, 0.9, -d * 0.28], COL.wood, { roughness: 0.7 });
    },
    rack: (g, w, d, h) => {
      const tiers = Math.max(3, Math.round(h / 0.45));
      for (let i = 0; i < tiers; i++)
        box(g, [w, 0.022, d], [0, 0.12 + i * ((h - 0.12) / (tiers - 1)), 0], COL.steel, { material: steel });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
        cyl(g, 0.017, h, [sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03)], COL.steelDark,
          { material: steelDark, seg: 8 }));
    },
    locker: (g, w, d, h) => {
      const n = Math.max(3, Math.round(w / 0.4));
      box(g, [w, h, d], [0, h / 2, 0], 0x46565f, { roughness: 0.62, metalness: 0.34 });
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + w / n * (i + 0.5);
        box(g, [w / n - 0.02, h * 0.46, 0.012], [x, h * 0.72, d / 2 + 0.007], 0x35434b, { shadow: false });
        box(g, [w / n - 0.02, h * 0.46, 0.012], [x, h * 0.26, d / 2 + 0.007], 0x35434b, { shadow: false });
      }
    },
    upright: (g, w, d, h) => {
      box(g, [w, h, d], [0, h / 2, 0], 0xd7dee2, { roughness: 0.42, metalness: 0.3 });
      box(g, [w * 0.9, h * 0.6, 0.03], [0, h * 0.62, d / 2 + 0.01], COL.glass,
        { opacity: 0.36, roughness: 0.08, metalness: 0.2 });
      box(g, [w * 0.94, 0.06, d * 0.92], [0, h * 0.04, 0], COL.steelDark, { material: steelDark });
    },
    freezer: (g, w, d, h) => {
      box(g, [w, h * 0.9, d], [0, h * 0.45, 0], 0xdfe5e8, { roughness: 0.45, metalness: 0.22 });
      box(g, [w * 0.98, h * 0.1, d * 0.98], [0, h * 0.95, 0], 0xeef2f4, { roughness: 0.3, metalness: 0.3 });
    },
    bin: (g, w, d, h) => {
      box(g, [w, h * 0.8, d], [0, h * 0.42, 0], COL.bin, { roughness: 0.68, metalness: 0.06 });
      box(g, [w * 1.02, h * 0.09, d * 1.02], [0, h * 0.86, 0], 0x356b3f, { roughness: 0.6 });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
        cyl(g, 0.05, 0.06, [sx * (w / 2 - 0.08), 0.05, sz * (d / 2 - 0.08)], 0x1d2529, { seg: 10 }));
    },
    sink: (g, w, d, h) => {
      worktop(g, w, d, h);
      box(g, [w * 0.62, 0.18, d * 0.62], [0, h - 0.11, 0], 0x8e9ba2, { material: steelDark });
      cyl(g, 0.016, 0.3, [0, h + 0.15, -d * 0.34], COL.steelDark, { material: steelDark, seg: 8 });
    },
    sink2: (g, w, d, h) => {
      worktop(g, w, d, h);
      [-1, 1].forEach((s) => {
        box(g, [w * 0.4, 0.19, d * 0.64], [s * w * 0.23, h - 0.115, 0], 0x8e9ba2, { material: steelDark });
        cyl(g, 0.014, 0.28, [s * w * 0.23, h + 0.14, -d * 0.34], COL.steelDark, { material: steelDark, seg: 8 });
      });
    },
    kettle: (g, w, d, h) => {
      box(g, [w * 0.96, h * 0.72, d * 0.96], [0, h * 0.36, 0], COL.hob, { roughness: 0.52, metalness: 0.44 });
      box(g, [w, 0.05, d], [0, h * 0.74, 0], COL.steelDark, { material: steelDark });
      cyl(g, w * 0.32, 0.4, [0, h * 0.74 + 0.2, 0], COL.pot, { roughness: 0.3, metalness: 0.68, seg: 24 });
      cyl(g, w * 0.33, 0.03, [0, h * 0.74 + 0.41, 0], 0xc3ced4, { roughness: 0.25, metalness: 0.7, seg: 24 });
      cyl(g, 0.02, 0.09, [0, h * 0.74 + 0.46, 0], 0xc3ced4, { seg: 8 });
      legs(g, w * 0.92, d * 0.92, h * 0.36, 0.06);
    },
    wok: (g, w, d, h) => {
      box(g, [w * 0.96, h * 0.72, d * 0.96], [0, h * 0.36, 0], COL.hob, { roughness: 0.52, metalness: 0.44 });
      box(g, [w, 0.05, d], [0, h * 0.74, 0], COL.steelDark, { material: steelDark });
      const bowl = new THREE.Mesh(
        new THREE.SphereGeometry(w * 0.36, 22, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        mat(0x5a676f, { roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
      bowl.position.set(0, h * 0.74 + w * 0.34, 0);
      bowl.rotation.x = Math.PI;
      bowl.castShadow = true;
      g.add(bowl);
      legs(g, w * 0.92, d * 0.92, h * 0.36, 0.06);
    },
    "tray-table": (g, w, d, h) => {
      worktop(g, w, d, h);
      // Ompreng tertata rapat seperti pada render R. PEMORSIAN, ±300 × 240 mm.
      const cols = Math.max(2, Math.round(w / 0.3)), rows = Math.max(2, Math.round(d / 0.24));
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++)
          box(g, [w / cols - 0.035, 0.05, d / rows - 0.035],
            [-w / 2 + w / cols * (i + 0.5), h + 0.025, -d / 2 + d / rows * (j + 0.5)],
            COL.tray, { roughness: 0.7, metalness: 0.2, shadow: false });
    },
  };

  EQUIPMENT.forEach((e) => {
    const g = new THREE.Group();
    const w = M(e.w), d = M(e.d), h = M(e.h);
    (BUILDERS[e.kind] || BUILDERS.table)(g, w, d, h);
    g.position.set(M(e.x), 0, M(e.y));
    g.rotation.y = (e.rot || 0) * DEG;
    g.traverse((o) => { if (o.isMesh) o.userData.pick = { type: "equip", code: e.code }; });
    const sp = label(e.code, { fs: 34, scale: 0.0016, layerName: "code" });
    sp.position.set(0, h + (e.kind === "rack" || e.kind === "upright" ? 0.24 : 0.46), 0);
    g.add(sp);
    equipGroup.add(g);
    equipByCode.set(e.code, g);
  });

  // ── Kitchen hood di atas hot line ────────────────────────────────────────
  const hoodGroup = new THREE.Group(); world.add(hoodGroup);
  const hoodMeshes = [];
  const hotUnits = EQUIPMENT.filter((e) => e.hot);
  const hotMinX = Math.min(...hotUnits.map((e) => e.x - e.w / 2));
  const hotMaxX = Math.max(...hotUnits.map((e) => e.x + e.w / 2));
  const HOOD_OVERHANG = 150;                                   // lihat catatan di panel
  const hoodLen = (hotMaxX - hotMinX) + HOOD_OVERHANG * 2;
  const hoodCx = (hotMinX + hotMaxX) / 2;
  const hoodZ = 540;
  {
    const shape = new THREE.Shape();
    shape.moveTo(-0.62, -0.26); shape.lineTo(0.62, -0.26);
    shape.lineTo(0.46, 0.26); shape.lineTo(-0.46, 0.26); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: M(hoodLen), bevelEnabled: false });
    geo.translate(0, 0, -M(hoodLen) / 2);
    geo.rotateY(Math.PI / 2);
    const body = new THREE.Mesh(geo, mat(COL.hood, { roughness: 0.26, metalness: 0.82 }));
    body.castShadow = true;
    hoodGroup.add(body);
    hoodGroup.position.set(M(hoodCx), 2.02, M(hoodZ));
    box(hoodGroup, [M(hoodLen) + 0.08, 0.06, 1.28], [0, -0.29, 0], 0x76858c, { roughness: 0.4, metalness: 0.55 });
    // Baffle filter
    const n = Math.max(4, Math.round(hoodLen / 900));
    for (let i = 0; i < n; i++) {
      const b = box(hoodGroup, [M(hoodLen) / n - 0.07, 0.024, 0.5],
        [-M(hoodLen) / 2 + M(hoodLen) / n * (i + 0.5), -0.33, 0], 0x4d5e66, { roughness: 0.5, metalness: 0.5 });
      b.rotation.x = -0.08;
    }
    box(hoodGroup, [0.52, 1.02, 0.52], [0, 0.78, 0], 0x84939a, { roughness: 0.4, metalness: 0.6 });
    hoodGroup.traverse((o) => { if (o.isMesh) hoodMeshes.push(o); });
    const hl = label(`HOOD ${id(Math.round(hoodLen))} mm`, { fs: 38, color: "#f1ca48", border: "rgba(241,202,72,.4)", scale: 0.0021 });
    hl.position.set(0, 0.62, 0.9);
    hoodGroup.add(hl);
  }

  // ── Gutter + grill ───────────────────────────────────────────────────────
  const gutterGroup = new THREE.Group(); world.add(gutterGroup);
  GUTTERS.forEach((gt) => {
    const [x0, y0, x1, y1] = gt.rect;
    const w = M(x1 - x0), d = M(y1 - y0);
    const g = new THREE.Group();
    box(g, [w, M(200), d], [0, -M(70), 0], COL.gutter, { roughness: 0.9, metalness: 0.05 });
    const along = w >= d ? "x" : "z";
    const len = along === "x" ? w : d, n = Math.max(6, Math.round(len / 0.06));
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + len / n * (i + 0.5);
      const sz = along === "x" ? [len / n * 0.5, M(26), d * 0.92] : [w * 0.92, M(26), len / n * 0.5];
      const ps = along === "x" ? [t, M(38), 0] : [0, M(38), t];
      box(g, sz, ps, COL.grill, { roughness: 0.5, metalness: 0.45, shadow: false });
    }
    g.position.set(M((x0 + x1) / 2), 0, M((y0 + y1) / 2));
    g.traverse((o) => { if (o.isMesh) o.userData.pick = { type: "gutter", code: gt.code }; });
    gutterGroup.add(g);
  });

  // Rangkaian pipa lurus dengan siku bulat di tiap belokan.
  function pipe(parent, pts, radius, material) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      if (len < 1e-4) continue;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), material);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        new THREE.Vector3().subVectors(b, a).normalize());
      m.castShadow = true;
      parent.add(m);
    }
    pts.forEach((p, i) => {
      if (i === 0 || i === pts.length - 1) return;
      const e = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), material);
      e.position.copy(p);
      parent.add(e);
    });
  }

  // ── Instalasi gas (skematik) ─────────────────────────────────────────────
  const gasGroup = new THREE.Group(); world.add(gasGroup);
  {
    const gasMat = mat(COL.gas, { roughness: 0.32, metalness: 0.3, emissive: 0x6d3a08, emissiveIntensity: 1.5 });
    pipe(gasGroup, GAS_ROUTE.map(([x, y]) => new THREE.Vector3(M(x), M(360), M(y))), 0.038, gasMat);
    // Riser + kran ke tiap unit hot line
    hotUnits.forEach((e) => {
      const zz = M(e.y + e.d / 2 + 40);
      pipe(gasGroup, [
        new THREE.Vector3(M(e.x), M(360), M(900)),
        new THREE.Vector3(M(e.x), M(360), zz),
        new THREE.Vector3(M(e.x), M(660), zz),
      ], 0.024, gasMat);
      box(gasGroup, [0.1, 0.05, 0.05], [M(e.x), M(660), zz], 0, { material: gasMat });
    });
    // Tabung LPG di R. Gas
    LPG.forEach(([x, y], i) => {
      const t = new THREE.Group();
      cyl(t, 0.185, 0.72, [0, 0.36, 0], 0x2f8f63, { roughness: 0.45, metalness: 0.35, seg: 18 });
      cyl(t, 0.11, 0.1, [0, 0.75, 0], 0x8d9aa1, { rTop: 0.06, seg: 14, roughness: 0.35, metalness: 0.6 });
      t.position.set(M(x), 0, M(y));
      t.traverse((o) => { if (o.isMesh) o.userData.pick = { type: "lpg", code: `LPG-${String(i + 1).padStart(2, "0")}` }; });
      gasGroup.add(t);
    });
    const gl = label("JALUR GAS · SKEMATIK", { fs: 34, color: "#ff9c3f", border: "rgba(255,156,63,.45)", scale: 0.0019 });
    gl.position.set(M(20700), 1.5, M(3700));
    gasGroup.add(gl);
  }

  // ── Air kotor & limbah ───────────────────────────────────────────────────
  const wasteGroup = new THREE.Group(); world.add(wasteGroup);
  WASTE.forEach((w) => {
    const [x0, y0, x1, y1] = w.rect;
    const g = new THREE.Group();
    if (w.shape === "circle") {
      cyl(g, M(x1 - x0) / 2, M(400), [0, -M(120), 0], COL.waste, { roughness: 0.9, metalness: 0.05, seg: 28 });
    } else {
      box(g, [M(x1 - x0), M(400), M(y1 - y0)], [0, -M(120), 0], COL.waste, { roughness: 0.9, metalness: 0.05 });
    }
    g.position.set(M((x0 + x1) / 2), 0, M((y0 + y1) / 2));
    g.traverse((o) => { if (o.isMesh) o.userData.pick = { type: "waste", code: w.code }; });
    const l = label(w.name, { fs: 32, color: "#9fb6bf", border: "rgba(122,150,162,.4)", scale: 0.0019 });
    l.position.set(0, 0.95, 0);
    g.add(l);
    wasteGroup.add(g);
  });
  {
    pipe(wasteGroup, WASTE_PIPE.map(([x, y]) => new THREE.Vector3(M(x), -M(180), M(y))), 0.055,
      mat(0x5fa3c6, { roughness: 0.5, metalness: 0.2, emissive: 0x16404f, emissiveIntensity: 1.2 }));
  }

  // ── Lampu TL ─────────────────────────────────────────────────────────────
  const lampGroup = new THREE.Group(); world.add(lampGroup);
  LAMPS.forEach(([x, y]) => {
    const g = new THREE.Group();
    box(g, [0.16, 0.05, 1.0], [0, 0, 0], 0x9fabb1, { roughness: 0.5, metalness: 0.4, shadow: false });
    box(g, [0.12, 0.02, 0.96], [0, -0.034, 0], COL.lamp,
      { emissive: 0xffe9b0, emissiveIntensity: 2.2, roughness: 0.4, shadow: false });
    g.position.set(M(x), 2.78, M(y));
    lampGroup.add(g);
  });

  // ── Penanda sirkulasi ────────────────────────────────────────────────────
  MARKERS.forEach((m) => {
    const sp = label(m.text, { fs: 40, color: m.color, border: "rgba(241,202,72,.4)", scale: 0.0024 });
    sp.position.set(M(m.x), 0.45, M(m.y));
    world.add(sp);
  });

  // ── Dimensi bangunan ─────────────────────────────────────────────────────
  function dimension(a, b, text) {
    const g = new THREE.Group();
    const mLine = new THREE.LineBasicMaterial({ color: 0x3fd0c9, transparent: true, opacity: 0.55 });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mLine));
    const tick = 0.16;
    [a, b].forEach((p) => {
      const d = new THREE.Vector3().subVectors(b, a).normalize();
      const n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(tick);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [p.clone().sub(n), p.clone().add(n)]), mLine));
    });
    const sp = label(text, { fs: 32, color: "#3fd0c9", border: "rgba(63,208,201,.4)", scale: 0.0018 });
    sp.position.copy(a.clone().add(b).multiplyScalar(0.5)).setY(0.22);
    g.add(sp);
    world.add(g);
  }
  const V = (x, y) => new THREE.Vector3(M(x), 0.08, M(y));
  dimension(V(0, 21400), V(20000, 21400), "20.000 mm");
  dimension(V(-1400, 0), V(-1400, 20000), "20.000 mm");

  // ── Grup lapisan ─────────────────────────────────────────────────────────
  const LAYERS = {
    equip: equipGroup, gas: gasGroup, hood: hoodGroup, gutter: gutterGroup,
    lamp: lampGroup, waste: wasteGroup, roomLabel: roomLabels,
  };
  const layerState = { equip: true, gas: true, hood: true, gutter: true, lamp: false, waste: true, roomLabel: true, code: false };
  function applyLayers() {
    Object.entries(LAYERS).forEach(([k, g]) => { g.visible = layerState[k]; });
    equipGroup.traverse((o) => { if (o.isSprite && o.userData.layer === "code") o.visible = layerState.code; });
    renderer.shadowMap.needsUpdate = true;
  }

  // ── Fokus area ───────────────────────────────────────────────────────────
  const FOCUS = {
    all:        { label: "Seluruh bangunan", rooms: null,
                  cam: [17, 19, 30], target: [10, 0.6, 10] },
    produksi:   { label: "R. Produksi", rooms: ["R-01"],
                  cam: [10.5, 7.2, 16.5], target: [15.9, 0.9, 4] },
    pemorsian:  { label: "R. Pemorsian", rooms: ["D-02", "D-01"],
                  cam: [10.5, 7.6, 21], target: [16.5, 0.9, 11.4] },
    persiapan:  { label: "Area Persiapan", rooms: ["S-03", "G-05"],
                  cam: [4.2, 6.4, 13.5], target: [9.6, 0.9, 4.7] },
    cuci:       { label: "Zona cuci", rooms: ["S-01", "S-04"],
                  cam: [9, 7, 25.5], target: [12, 0.9, 16.5] },
    gudang:     { label: "Gudang & terima", rooms: ["G-01", "G-02", "G-03", "G-04", "S-02"],
                  cam: [1.5, 7.4, 14], target: [5.5, 0.9, 7.5] },
    staff:      { label: "Staf & kantor", rooms: ["A-01", "A-02", "A-03", "K-01", "K-02", "T-01", "T-02", "T-03", "T-04"],
                  cam: [-5.5, 8.2, 13], target: [1.7, 0.9, 9.8] },
    gas:        { label: "R. Gas & jalur", rooms: ["U-01", "R-01"],
                  cam: [26, 6.5, 12], target: [18.5, 1, 3.7] },
  };

  // ── Kamera ───────────────────────────────────────────────────────────────
  const VIEWS = {
    iso:  { cam: [17, 19, 30], target: [10, 0.6, 10], up: [0, 1, 0] },
    top:  { cam: [10, 36, 7.71], target: [10, 0, 7.7], up: [0, 0, -1] },
    hot:  { cam: [10.5, 7.2, 16.5], target: [15.9, 0.9, 4], up: [0, 1, 0] },
    pack: { cam: [10.5, 7.6, 21], target: [16.5, 0.9, 11.4], up: [0, 1, 0] },
  };
  // Hood ditembuspandangkan saat denah atas aktif.
  function setHoodGhost(on) {
    hoodMeshes.forEach((m) => {
      m.material.transparent = on;
      m.material.opacity = on ? 0.3 : 1;
      m.material.depthWrite = !on;
      m.material.needsUpdate = true;
    });
  }

  function goto(cam, target, up) {
    camera.up.set(...(up || [0, 1, 0]));
    camera.position.set(cam[0] - 10, cam[1], cam[2] - 10);
    controls.target.set(target[0] - 10, target[1], target[2] - 10);
    controls.update();
  }

  let currentFocus = "all";
  function applyFocus(k) {
    currentFocus = k;
    const f = FOCUS[k];
    const set = f.rooms ? new Set(f.rooms) : null;
    EQUIPMENT.forEach((e) => {
      const g = equipByCode.get(e.code);
      if (g) g.visible = !set || set.has(e.room);
    });
    roomMeshes.forEach((g, code) => {
      const on = !set || set.has(code);
      g.traverse((o) => { if (o.isMesh) o.material.opacity = on ? 1 : 0.25; });
    });
    roomLabels.children.forEach((sp) => {
      sp.material.opacity = !set || set.has(sp.userData.roomCode) ? 1 : 0.18;
    });
    currentView = null;
    setHoodGhost(false);
    goto(f.cam, f.target);
    renderer.shadowMap.needsUpdate = true;
  }

  // ── Seleksi ──────────────────────────────────────────────────────────────
  const outline = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x3fd0c9, wireframe: true, transparent: true, opacity: 0.85 }));
  outline.visible = false;
  world.add(outline);

  function highlight(code) {
    const e = EQUIPMENT.find((x) => x.code === code);
    if (!e) { outline.visible = false; return; }
    outline.scale.set(M(e.w) + 0.06, M(e.h) + 0.06, M(e.d) + 0.06);
    outline.position.set(M(e.x), M(e.h) / 2, M(e.y));
    outline.rotation.y = (e.rot || 0) * DEG;
    outline.visible = true;
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null, dragged = false;
  renderer.domElement.addEventListener("pointerdown", (ev) => { downAt = [ev.clientX, ev.clientY]; dragged = false; });
  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (!downAt) return;
    if ((ev.clientX - downAt[0]) ** 2 + (ev.clientY - downAt[1]) ** 2 > 64) dragged = true;
  });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (dragged) { downAt = null; return; }
    downAt = null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([equipGroup, gutterGroup, gasGroup, wasteGroup, floorsGroup], true);
    for (const h of hits) {
      const p = h.object.userData.pick;
      if (p) { select(p.type, p.code); return; }
    }
  });

  // ═══ Antarmuka ═══════════════════════════════════════════════════════════
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };

  let selection = { type: "equip", code: "PR-01" };
  let activeTab = "detail";

  function select(type, code) {
    selection = { type, code };
    if (type === "equip") highlight(code); else outline.visible = false;
    activeTab = "detail";
    renderInspector();
    renderTabs();
  }

  // ── Rail ─────────────────────────────────────────────────────────────────
  function railButton(text, active, onClick, opts = {}) {
    const b = el("button", `rail-button${active ? " active" : ""}${opts.cls ? " " + opts.cls : ""}`);
    b.appendChild(el("i", "dot"));
    b.appendChild(el("span", null, text));
    if (opts.tag) b.appendChild(el("span", "tag", opts.tag));
    b.addEventListener("click", onClick);
    return b;
  }

  let currentView = "iso";
  function renderRail() {
    const rail = $("#rail");
    rail.textContent = "";

    const g1 = el("div", "rail-group");
    g1.appendChild(el("p", "rail-title", "Sudut pandang"));
    [["iso", "Isometrik"], ["top", "Denah atas"], ["hot", "Hot line"], ["pack", "Pemorsian"]].forEach(([k, t]) => {
      g1.appendChild(railButton(t, currentView === k, () => {
        currentView = k; autoRotate = false;
        setHoodGhost(k === "top");
        const v = VIEWS[k]; goto(v.cam, v.target, v.up);
        renderRail();
      }));
    });
    rail.appendChild(g1);

    const g2 = el("div", "rail-group");
    g2.appendChild(el("p", "rail-title", "Fokus area"));
    Object.entries(FOCUS).forEach(([k, f]) => {
      const n = f.rooms ? f.rooms.length : ROOMS.length;
      g2.appendChild(railButton(f.label, currentFocus === k, () => {
        autoRotate = false; applyFocus(k); renderRail();
      }, { tag: String(n) }));
    });
    rail.appendChild(g2);

    const g3 = el("div", "rail-group");
    g3.appendChild(el("p", "rail-title", "Lapisan"));
    [["equip", "Peralatan"], ["gutter", "Gutter + grill"], ["hood", "Kitchen hood"],
     ["gas", "Jalur gas"], ["waste", "Air kotor & limbah"], ["lamp", "Lampu TL"],
     ["roomLabel", "Nama ruang"], ["code", "Kode peralatan"]].forEach(([k, t]) => {
      g3.appendChild(railButton(t, layerState[k], () => {
        layerState[k] = !layerState[k]; applyLayers(); renderRail();
      }, { cls: k === "gas" ? "gas" : "" }));
    });
    rail.appendChild(g3);

    const g4 = el("div", "rail-group");
    g4.appendChild(el("p", "rail-title", "Animasi"));
    g4.appendChild(railButton("Putar otomatis", autoRotate, () => {
      autoRotate = !autoRotate; renderRail();
    }));
    rail.appendChild(g4);

    const g5 = el("div", "rail-group");
    g5.appendChild(el("p", "rail-title", "Zona"));
    const key = el("div", "zone-key");
    Object.values(ZONES).forEach((z) => {
      const i = el("div", "zone-chip");
      const sw = el("i");
      sw.style.background = "#" + z.color.toString(16).padStart(6, "0");
      i.appendChild(sw);
      i.appendChild(document.createTextNode(z.label));
      key.appendChild(i);
    });
    g5.appendChild(key);
    rail.appendChild(g5);
  }

  // ── Inspector ────────────────────────────────────────────────────────────
  function renderTabs() {
    const t = $("#tabs");
    t.textContent = "";
    [["detail", "Detail", ""], ["rooms", "Ruang", String(ROOMS.length)],
     ["equip", "Peralatan", String(EQUIPMENT.length)], ["src", "Sumber", ""]].forEach(([k, lbl, cnt]) => {
      const b = el("button", `tab${activeTab === k ? " active" : ""}`);
      b.appendChild(document.createTextNode(lbl));
      if (cnt) b.appendChild(el("span", "count", cnt));
      b.addEventListener("click", () => { activeTab = k; renderTabs(); renderInspector(); });
      t.appendChild(b);
    });
  }

  function detailEquip(e) {
    const room = ROOMS.find((r) => r.code === e.room);
    const f = document.createDocumentFragment();
    const head = el("div", "detail-head");
    head.appendChild(el("span", "chip", e.code));
    head.appendChild(el("span", "chip zone", room ? room.name : "—"));
    if (e.estimated) head.appendChild(el("span", "chip est", "EST"));
    f.appendChild(head);
    f.appendChild(el("h2", "detail-name", e.name));
    const dims = el("div", "dims");
    [["Panjang", e.w], ["Lebar", e.d], ["Tinggi", e.h]].forEach(([k, v]) => {
      const d = el("div", "dim");
      d.appendChild(el("div", "k", k));
      d.appendChild(el("div", "v", `${id(v)}<small> mm</small>`));
      dims.appendChild(d);
    });
    f.appendChild(dims);
    const n = el("div", `note${e.estimated ? " warn" : ""}`);
    n.appendChild(el("div", "k", e.estimated ? "Sebagian ukuran estimasi" : "Sesuai referensi"));
    n.appendChild(el("p", null, e.basis));
    f.appendChild(n);
    const kv = el("div");
    [["Posisi denah", `x ${id(e.x)} · y ${id(e.y)} mm`],
     ["Zona", room ? ZONES[room.zone].label : "—"],
     ["Skala model", "1 unit = 1 meter"]].forEach(([k, v]) => {
      const r = el("div", "kv");
      r.appendChild(el("span", "k", k));
      r.appendChild(el("span", "v", v));
      kv.appendChild(r);
    });
    f.appendChild(kv);
    return f;
  }

  function detailRoom(r) {
    const [x0, y0, x1, y1] = r.rect;
    const area = areaOf(r);
    const items = EQUIPMENT.filter((e) => e.room === r.code);
    const f = document.createDocumentFragment();
    const head = el("div", "detail-head");
    head.appendChild(el("span", "chip", r.code));
    head.appendChild(el("span", "chip zone", ZONES[r.zone].label));
    f.appendChild(head);
    f.appendChild(el("h2", "detail-name", r.name));
    const dims = el("div", "dims");
    [["Bentang X", x1 - x0], ["Bentang Y", y1 - y0]].forEach(([k, v]) => {
      const d = el("div", "dim");
      d.appendChild(el("div", "k", k));
      d.appendChild(el("div", "v", `${id(v)}<small> mm</small>`));
      dims.appendChild(d);
    });
    const d3 = el("div", "dim");
    d3.appendChild(el("div", "k", "Luas neto"));
    d3.appendChild(el("div", "v", `${area.toFixed(1)}<small> m²</small>`));
    dims.appendChild(d3);
    f.appendChild(dims);
    const n = el("div", "note");
    n.appendChild(el("div", "k", "Basis geometri"));
    n.appendChild(el("p", null,
      `Koordinat dinding diekstrak dari vektor DENAH (skala 1:100) pada GBR_SPPG_TANJUNGSARI_004.pdf. Peil lantai ${r.level === 0 ? "± 0.00" : (r.level / 1000).toFixed(2)} m.`));
    f.appendChild(n);
    if (items.length) {
      f.appendChild(el("p", "list-sub", `Peralatan · ${items.length}`));
      items.forEach((e) => f.appendChild(equipRow(e)));
    } else {
      const n2 = el("div", "note");
      n2.appendChild(el("div", "k", "Belum ada peralatan termodel"));
      n2.appendChild(el("p", null, "Ruang ini belum memuat unit pada denah berperabot yang dapat diukur; tambahkan setelah BoQ peralatan terbit."));
      f.appendChild(n2);
    }
    return f;
  }

  function detailSimple(title, code, chip, text) {
    const f = document.createDocumentFragment();
    const head = el("div", "detail-head");
    head.appendChild(el("span", "chip", code));
    head.appendChild(el("span", "chip zone", chip));
    f.appendChild(head);
    f.appendChild(el("h2", "detail-name", title));
    const n = el("div", "note");
    n.appendChild(el("div", "k", "Basis"));
    n.appendChild(el("p", null, text));
    f.appendChild(n);
    return f;
  }

  function equipRow(e) {
    const b = el("button", `list-row${selection.type === "equip" && selection.code === e.code ? " active" : ""}`);
    b.appendChild(el("span", "code", e.code));
    const body = el("div", "body");
    body.appendChild(el("b", null, e.name));
    body.appendChild(el("span", null, `${id(e.w)} × ${id(e.d)} × ${id(e.h)} mm`));
    b.appendChild(body);
    if (e.estimated) b.appendChild(el("span", "flag", "EST"));
    b.addEventListener("click", () => select("equip", e.code));
    return b;
  }

  function roomRow(r) {
    const area = areaOf(r);
    const n = EQUIPMENT.filter((e) => e.room === r.code).length;
    const b = el("button", `list-row${selection.type === "room" && selection.code === r.code ? " active" : ""}`);
    const sw = el("div", "swatch");
    sw.style.background = "#" + ZONES[r.zone].color.toString(16).padStart(6, "0");
    b.appendChild(sw);
    const body = el("div", "body");
    body.appendChild(el("b", null, r.name));
    body.appendChild(el("span", null, `${r.code} · ${area.toFixed(1)} m²${n ? ` · ${n} unit` : ""}`));
    b.appendChild(body);
    b.addEventListener("click", () => select("room", r.code));
    return b;
  }

  function renderInspector() {
    const body = $("#panel-body");
    body.textContent = "";
    if (activeTab === "detail") {
      if (selection.type === "equip") {
        const e = EQUIPMENT.find((x) => x.code === selection.code);
        if (e) body.appendChild(detailEquip(e));
      } else if (selection.type === "room") {
        const r = ROOMS.find((x) => x.code === selection.code);
        if (r) body.appendChild(detailRoom(r));
      } else if (selection.type === "gutter") {
        const g = GUTTERS.find((x) => x.code === selection.code);
        if (g) {
          const [x0, y0, x1, y1] = g.rect;
          body.appendChild(detailSimple(g.name, g.code, "Utilitas",
            `${g.basis} Dimensi terpasang ${id(Math.max(x1 - x0, y1 - y0))} × ${id(Math.min(x1 - x0, y1 - y0))} mm.`));
        }
      } else if (selection.type === "waste") {
        const w = WASTE.find((x) => x.code === selection.code);
        if (w) body.appendChild(detailSimple(w.name, w.code, "Air kotor", w.basis));
      } else if (selection.type === "lpg") {
        body.appendChild(detailSimple("Tabung LPG", selection.code, "R. Gas",
          "Enam tabung LPG terbaca pada denah berperabot di R. Gas (1.500 × 2.500 mm) yang menempel di dinding timur R. Produksi. Diameter simbol ±370 mm, setara tabung 50 kg. Jumlah dan kapasitas perlu dikonfirmasi ke spesifikasi mekanikal."));
      }
    } else if (activeTab === "rooms") {
      const byZone = {};
      ROOMS.forEach((r) => { (byZone[r.zone] ||= []).push(r); });
      Object.keys(ZONES).forEach((z) => {
        if (!byZone[z]) return;
        body.appendChild(el("p", "list-sub", `${ZONES[z].label} · ${byZone[z].length}`));
        byZone[z].forEach((r) => body.appendChild(roomRow(r)));
      });
    } else if (activeTab === "src") {
      body.appendChild(renderSources());
    } else {
      const byRoom = {};
      EQUIPMENT.forEach((e) => { (byRoom[e.room] ||= []).push(e); });
      ROOMS.forEach((r) => {
        if (!byRoom[r.code]) return;
        body.appendChild(el("p", "list-sub", `${r.name} · ${byRoom[r.code].length}`));
        byRoom[r.code].forEach((e) => body.appendChild(equipRow(e)));
      });
    }
  }

  // ── Sumber data & catatan terbuka ────────────────────────────────────────
  function note(kind, title, text) {
    const n = el("div", `note${kind ? " " + kind : ""}`);
    n.appendChild(el("div", "k", title));
    n.appendChild(el("p", null, text));
    return n;
  }

  function renderSources() {
    const est = EQUIPMENT.filter((e) => e.estimated).length;
    const f = document.createDocumentFragment();

    f.appendChild(el("p", "list-sub", "Dokumen sumber"));
    f.appendChild(note("", "[A] GBR_SPPG_TANJUNGSARI_004.pdf",
      "Gambar kerja CorelDRAW, 4 lembar, skala 1:100 — DENAH, DENAH PENUTUP LANTAI, " +
      "INSTALASI ELEKTRIKAL, INST. AIR KOTOR DAN LIMBAH. Pemilik: Yayasan Alqoyyim " +
      "Al Qoyidiyah Bina Mulia."));
    f.appendChild(note("", "[B] 26-12-2025_SPPG-TANJUNGSARI.pdf",
      "Lembar kerja teknis 13 halaman: denah berperabot + legenda 19 ruang, aksonometri, " +
      "dan render R. Persiapan, R. Produksi, R. Pemorsian, Lobby, R. Konsultasi, R. Kerja."));

    f.appendChild(el("p", "list-sub", "Tingkat kepastian"));
    f.appendChild(note("", "Presisi terhadap gambar kerja",
      "Dinding (42 segmen, tebal 150 mm), batas dan peil ruang, gutter + grill, posisi " +
      "R. Gas, septictank / grease trap / sumur resapan, serta titik lampu TL diekstrak " +
      "langsung dari vektor [A] — bukan dijiplak dari raster, sehingga cocok 1:1 dengan " +
      "as-grid 1–13 / A–Q."));
    f.appendChild(note("warn", `Estimasi — ${est} dari ${EQUIPMENT.length} unit peralatan`,
      "Paket gambar tidak memuat BoQ/daftar peralatan dapur. Panjang dan lebar tiap unit " +
      "diukur dari simbol pada denah berperabot [B]; tinggi memakai ukuran fabrikasi lazim. " +
      "Semua angka ini harus dikunci ulang saat spesifikasi peralatan terbit."));

    f.appendChild(el("p", "list-sub", "Catatan terbuka"));
    f.appendChild(note("warn", "Jalur gas belum ada gambarnya",
      "Paket [A] hanya memuat elektrikal dan air kotor. Rute pipa yang ditampilkan bersifat " +
      "skematik: R. Gas → dinding timur R. Produksi → hot line, mengikuti garis pipa yang " +
      "tergambar menembus keenam unit masak pada [B]. Diameter, tekanan, regulator, dan " +
      "titik shut-off belum ditentukan."));
    f.appendChild(note("warn", "Kitchen hood belum berdimensi",
      `Hood tidak muncul pada denah [A] tetapi jelas terlihat pada render R. Produksi [B]. ` +
      `Panjang model ${id(Math.round(hoodLen))} mm = bentang hot line ${id(Math.round(hotMaxX - hotMinX))} mm ` +
      `+ overhang ${id(HOOD_OVERHANG)} mm di tiap ujung. Overhang ini asumsi, bukan angka dari gambar.`));
    f.appendChild(note("warn", "Fungsi dua unit belum pasti",
      "PR-01 dan PR-02 bersimbol panci bertutup, PR-03…06 bersimbol kuali. Pembedaan ini " +
      "dibaca dari simbol denah dan render; jenis kompor (bertekanan tinggi atau biasa) " +
      "serta kapasitas belum tercantum."));

    f.appendChild(el("p", "list-sub", "Konvensi model"));
    const kv = el("div");
    [["Titik nol", "as-1 / as-Q (sudut barat laut)"],
     ["Sumbu", "X ke timur · Y denah ke selatan"],
     ["Skala", "1 unit = 1 meter"],
     ["Tinggi potong dinding", `${id(BUILDING.cutH)} mm`],
     ["Tebal dinding", `${id(BUILDING.wallT)} mm`],
     ["Peil toilet", "− 0,05 m"]].forEach(([k, v]) => {
      const r = el("div", "kv");
      r.appendChild(el("span", "k", k));
      r.appendChild(el("span", "v", v));
      kv.appendChild(r);
    });
    f.appendChild(kv);
    return f;
  }

  // ── Statistik header & overlay ───────────────────────────────────────────
  function buildStats() {
    const area = ROOMS.reduce((s, r) => s + areaOf(r), 0);
    const est = EQUIPMENT.filter((e) => e.estimated).length;
    const gutterLen = GUTTERS.reduce((s, g) => {
      const [x0, y0, x1, y1] = g.rect;
      return s + Math.max(x1 - x0, y1 - y0);
    }, 0);

    const ts = $("#topstats");
    [[String(ROOMS.length), "Ruang"], [String(EQUIPMENT.length), "Unit alat"],
     [area.toFixed(0) + " m²", "Luas ruang"], [id(gutterLen) + " mm", "Gutter"]].forEach(([v, k]) => {
      const s = el("div", "stat");
      s.appendChild(el("b", null, v));
      s.appendChild(el("span", null, k));
      ts.appendChild(s);
    });

    const mt = $("#metrics");
    const rows = [
      { cls: "hot", k: "Hood coverage", v: id(Math.round(hoodLen)), u: "mm" },
      { cls: "", k: "Hot line", v: id(Math.round(hotMaxX - hotMinX)), u: "mm · 6 unit" },
      { cls: "gas", k: "Tabung LPG", v: String(LPG.length), u: "× R. Gas" },
      { cls: "", k: "Ukuran estimasi", v: `${est}/${EQUIPMENT.length}`, u: "unit" },
    ];
    rows.forEach((r) => {
      const d = el("div", `metric ${r.cls}`);
      d.appendChild(el("div", "k", r.k));
      d.appendChild(el("div", "v", `${r.v}<small>${r.u}</small>`));
      mt.appendChild(d);
    });

  }

  // Label ruang diskalakan menurut jarak kamera supaya tinggi tampaknya tetap:
  // terbaca saat melihat seluruh bangunan, tidak raksasa saat zoom ke satu ruang.
  const _lp = new THREE.Vector3();
  function scaleLabels() {
    for (const sp of roomLabels.children) {
      const dist = camera.position.distanceTo(sp.getWorldPosition(_lp));
      const k = THREE.MathUtils.clamp(dist / 35, 0.48, 1.7);
      sp.scale.set(sp.userData.baseScale.x * k, sp.userData.baseScale.y * k, 1);
    }
  }

  // ── Loop ─────────────────────────────────────────────────────────────────
  let autoRotate = false;
  function resize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  let t0 = performance.now();
  function tick(t) {
    const dt = (t - t0) / 1000; t0 = t;
    if (autoRotate) {
      const p = camera.position.clone().sub(controls.target);
      const a = dt * 0.18;
      const nx = p.x * Math.cos(a) - p.z * Math.sin(a);
      const nz = p.x * Math.sin(a) + p.z * Math.cos(a);
      camera.position.set(controls.target.x + nx, camera.position.y, controls.target.z + nz);
    }
    if (outline.visible) outline.material.opacity = 0.55 + 0.3 * Math.sin(t / 260);
    if (roomLabels.visible) scaleLabels();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  // ── Start ────────────────────────────────────────────────────────────────
  buildStats();
  applyLayers();
  applyFocus("all");
  currentView = "iso";
  goto(VIEWS.iso.cam, VIEWS.iso.target);
  highlight("PR-01");
  renderRail();
  renderTabs();
  renderInspector();
  resize();
  requestAnimationFrame(tick);
})();
