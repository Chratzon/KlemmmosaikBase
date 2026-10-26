/* KlemmmosaikBase – Oberfläche */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const E = KM.engine;

  /* ---------- Zustand ---------- */
  const DEFAULTS = {
    aspect: "1:1", crop: null, mode: "flat", width: 32, part: "round", optimize: true,
    colors: KM.COLORS.filter((c) => c.basic).map((c) => c.key),
    maxColors: 0, dither: 0, adj: { brightness: 0, contrast: 0, saturation: 0 },
    joints: true, step: 1, reserve: 10, tab: "image"
  };
  let S = structuredClone(DEFAULTS);
  const st = { img: null, imgUrl: null, edits: {}, editSig: "", history: [], cells: null, cellsKey: "", brush: "white", picking: false, editing: false };
  let M = null; // aktuelles Mosaik-Modell

  /* ---------- Hilfen ---------- */
  let toastT = 0;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }
  const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const fmt = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  const ratio = (a) => { if (a === "free") return null; const [w, h] = a.split(":").map(Number); return w / h; };
  const C = KM.COLOR_BY_KEY;

  const save = debounce(() => {
    KM.store.set("project", { settings: S, imgUrl: st.imgUrl, edits: st.edits, editSig: st.editSig }).catch(() => {});
  }, 400);

  /* ---------- Tabs ---------- */
  function showTab(tab) {
    S.tab = tab;
    document.querySelectorAll(".page").forEach((p) => (p.hidden = p.dataset.page !== tab));
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
    const has = !!st.img;
    document.querySelectorAll(".need-img").forEach((e) => (e.hidden = has));
    document.querySelectorAll(".has-img").forEach((e) => (e.hidden = !has));
    window.scrollTo(0, 0);
    if (tab === "image") drawCrop();
    else if (has) { ensureModel(); renderPage(); }
    save();
  }
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) showTab(g.dataset.goto); });

  /* ---------- Bild laden ---------- */
  function loadImageUrl(url) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
  }
  async function useImage(url, keepCrop) {
    const im = await loadImageUrl(url);
    // auf max. 1600 px verkleinern, damit Speichern und Rechnen schnell bleiben
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement("canvas");
    cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(im, 0, 0, cv.width, cv.height);
    st.imgUrl = k < 1 || !url.startsWith("data:image/jpeg") ? cv.toDataURL("image/jpeg", 0.9) : url;
    st.img = cv;
    st.cellsKey = "";
    if (!keepCrop || !S.crop) fitCrop();
    $("emptyState").hidden = true; $("cropArea").hidden = false;
    drawCrop(); invalidate(); save();
  }
  $("fileInput").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    try { st.edits = {}; await useImage(url, false); showTab("image"); }
    catch (err) { toast("Das Bild ließ sich nicht öffnen. Bitte JPG, PNG oder WebP wählen."); }
    e.target.value = "";
  });
  $("sampleBtn").addEventListener("click", async () => { st.edits = {}; await useImage(sampleImage(), false); });

  /* Beispielbild: Abendstimmung am Bergsee, im Browser gezeichnet */
  function sampleImage() {
    const W = 800, H = 800, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const sky = c.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, "#1d2b5a"); sky.addColorStop(0.45, "#c45a5a"); sky.addColorStop(1, "#f6b25c");
    c.fillStyle = sky; c.fillRect(0, 0, W, H * 0.6);
    c.fillStyle = "#ffe48a"; c.beginPath(); c.arc(W * 0.62, H * 0.42, 70, 0, Math.PI * 2); c.fill();
    const mount = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H * 0.6); pts.forEach(([x, y]) => c.lineTo(x * W, y * H)); c.lineTo(W, H * 0.6); c.closePath(); c.fill(); };
    mount([[0, 0.38], [0.18, 0.26], [0.32, 0.4], [0.5, 0.3], [0.7, 0.45], [0.86, 0.28], [1, 0.36]], "#4a3f63");
    mount([[0, 0.5], [0.22, 0.4], [0.4, 0.52], [0.6, 0.44], [0.8, 0.55], [1, 0.47]], "#2b2a40");
    const lake = c.createLinearGradient(0, H * 0.6, 0, H);
    lake.addColorStop(0, "#e59a5a"); lake.addColorStop(0.4, "#7a4a6a"); lake.addColorStop(1, "#1a2140");
    c.fillStyle = lake; c.fillRect(0, H * 0.6, W, H * 0.4);
    c.fillStyle = "rgba(255,228,138,.55)"; for (let i = 0; i < 9; i++) c.fillRect(W * 0.62 - 60 + i * 4, H * 0.62 + i * 22, 120 - i * 8, 6);
    c.fillStyle = "#121624";
    const tree = (x, y, s) => { c.beginPath(); c.moveTo(x, y - 160 * s); c.lineTo(x + 50 * s, y); c.lineTo(x - 50 * s, y); c.closePath(); c.fill(); c.fillRect(x - 6 * s, y, 12 * s, 24 * s); };
    tree(120, 640, 1.2); tree(200, 660, 0.9); tree(700, 650, 1.05);
    c.fillRect(0, H * 0.84, W, H * 0.16);
    return cv.toDataURL("image/jpeg", 0.92);
  }

  /* ---------- Zuschnitt ---------- */
  function fitCrop() {
    const iw = st.img.width, ih = st.img.height, r = ratio(S.aspect);
    let w = iw, h = ih;
    if (r) { if (iw / ih > r) w = ih * r; else h = iw / r; }
    S.crop = { x: (iw - w) / 2, y: (ih - h) / 2, w, h };
  }
  const cv = $("cropCanvas");
  let cropScale = 1;
  function drawCrop() {
    if (!st.img) { $("emptyState").hidden = false; $("cropArea").hidden = true; return; }
    $("emptyState").hidden = true; $("cropArea").hidden = false;
    const wrap = $("cropWrap"), maxW = wrap.clientWidth || 340, maxH = Math.max(260, window.innerHeight * 0.55);
    cropScale = Math.min(maxW / st.img.width, maxH / st.img.height);
    const W = Math.round(st.img.width * cropScale), H = Math.round(st.img.height * cropScale);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.drawImage(st.img, 0, 0, W, H);
    const k = S.crop, x = k.x * cropScale, y = k.y * cropScale, w = k.w * cropScale, h = k.h * cropScale;
    c.fillStyle = "rgba(8,12,16,.6)"; c.beginPath(); c.rect(0, 0, W, H); c.rect(x, y, w, h); c.fill("evenodd");
    c.strokeStyle = "#FFD23F"; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1;
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x + (w * i) / 3, y); c.lineTo(x + (w * i) / 3, y + h); c.moveTo(x, y + (h * i) / 3); c.lineTo(x + w, y + (h * i) / 3); c.stroke(); }
    c.fillStyle = "#FFD23F";
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => { c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.fill(); });
    document.querySelectorAll("#aspectChips button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.a === S.aspect ? "true" : "false"));
  }
  let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    if (!S.crop) return;
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / cropScale, py = (e.clientY - r.top) / cropScale;
    const k = S.crop, tol = 26 / cropScale;
    const corners = [[k.x, k.y], [k.x + k.w, k.y], [k.x, k.y + k.h], [k.x + k.w, k.y + k.h]];
    let ci = corners.findIndex(([cx, cy]) => Math.hypot(px - cx, py - cy) < tol);
    if (ci >= 0) drag = { type: "resize", ci, anchor: corners[3 - ci] };
    else if (px > k.x && px < k.x + k.w && py > k.y && py < k.y + k.h) drag = { type: "move", dx: px - k.x, dy: py - k.y };
    else return;
    cv.setPointerCapture(e.pointerId); e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(), iw = st.img.width, ih = st.img.height;
    let px = Math.max(0, Math.min(iw, (e.clientX - r.left) / cropScale)), py = Math.max(0, Math.min(ih, (e.clientY - r.top) / cropScale));
    const k = S.crop;
    if (drag.type === "move") {
      k.x = Math.max(0, Math.min(iw - k.w, px - drag.dx)); k.y = Math.max(0, Math.min(ih - k.h, py - drag.dy));
    } else {
      const [ax, ay] = drag.anchor, rr = ratio(S.aspect), min = Math.max(12, Math.min(iw, ih) * 0.04);
      let w = Math.abs(px - ax), h = Math.abs(py - ay);
      const sx = px < ax ? -1 : 1, sy = py < ay ? -1 : 1;
      const maxW = sx < 0 ? ax : iw - ax, maxH = sy < 0 ? ay : ih - ay;
      if (rr) { w = Math.max(w, h * rr); w = Math.min(w, maxW, maxH * rr); h = w / rr; if (w < min) { w = min; h = w / rr; } }
      else { w = Math.max(min, Math.min(w, maxW)); h = Math.max(min, Math.min(h, maxH)); }
      k.w = w; k.h = h; k.x = sx < 0 ? ax - w : ax; k.y = sy < 0 ? ay - h : ay;
    }
    drawCrop();
  });
  const endDrag = () => { if (drag) { drag = null; invalidate(); save(); } };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  $("aspectChips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.aspect = b.dataset.a; fitCrop(); drawCrop(); invalidate(); save(); });

  ["brightness", "contrast", "saturation"].forEach((id) => {
    const el = $(id);
    el.addEventListener("input", () => { S.adj[id] = +el.value; $(id + "Out").textContent = (el.value > 0 ? "+" : "") + el.value; invalidate(); save(); });
  });

  /* ---------- Mosaik berechnen ---------- */
  function dims() {
    const cols = Math.max(4, Math.min(S.mode === "side" ? 96 : 128, S.width | 0));
    const r = S.crop.h / S.crop.w;
    const rows = S.mode === "side" ? Math.max(4, Math.min(320, Math.round(cols * r * KM.STUD_MM / KM.PLATE_MM))) : Math.max(4, Math.min(160, Math.round(cols * r)));
    return { cols, rows };
  }
  function sig(cols, rows) { const k = S.crop; return [S.mode, cols, rows, k.x | 0, k.y | 0, k.w | 0, k.h | 0].join("|"); }
  function shapesFor() {
    if (S.mode === "side") return S.optimize ? KM.PARTS.side.shapes : KM.PARTS.side.shapes.filter((s) => s.w === 1);
    const set = KM.PARTS[S.part];
    if (!S.optimize) return set.shapes.filter((s) => s.w === 1 && s.h === 1);
    return set.shapes;
  }
  function piecesFor(keys, cols, rows) {
    return S.mode === "side" ? E.optimizeSide(keys, cols, rows, shapesFor()) : E.optimizeFlat(keys, cols, rows, shapesFor(), 16);
  }
  function compute() {
    if (!st.img) { M = null; return; }
    const { cols, rows } = dims();
    const ck = JSON.stringify([S.crop, S.adj, cols, rows]);
    if (ck !== st.cellsKey) { st.cells = E.sampleGrid(st.img, S.crop, cols, rows, S.adj); st.cellsKey = ck; }
    const sel = S.colors.length >= 2 ? S.colors : DEFAULTS.colors;
    let pal = E.buildPalette(sel);
    if (S.maxColors && S.maxColors < pal.length) pal = E.limitColors(st.cells, cols, rows, pal, S.maxColors);
    const idx = E.quantize(st.cells, cols, rows, pal, S.dither / 100);
    const keys = Array.from(idx, (i) => pal[i].key);
    const sg = sig(cols, rows);
    if (st.editSig !== sg) {
      if (Object.keys(st.edits).length) toast("Größe oder Ausschnitt geändert, Handänderungen wurden verworfen.");
      st.edits = {}; st.history = []; st.editSig = sg;
    }
    for (const i in st.edits) if (i < keys.length && C[st.edits[i]]) keys[i] = st.edits[i];
    M = { cols, rows, mode: S.mode, part: S.mode === "side" ? "side" : S.part, keys, pieces: piecesFor(keys, cols, rows) };
    M.parts = E.countParts(M.pieces);
    M.usedKeys = [...new Set(keys)].sort((a, b) => countOf(b) - countOf(a));
    function countOf(k) { let n = 0; for (const x of keys) if (x === k) n++; return n; }
    M.symbols = {}; M.usedKeys.forEach((k, i) => (M.symbols[k] = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(97 + i - 26)));
    M.sizeCm = [cols * KM.STUD_MM / 10, rows * (S.mode === "side" ? KM.PLATE_MM : KM.STUD_MM) / 10];
  }
  let dirty = true;
  function ensureModel() { if (dirty) { compute(); dirty = false; } }
  const rerender = debounce(() => { if (S.tab !== "image" && st.img) { ensureModel(); renderPage(); } }, 140);
  function invalidate() { dirty = true; rerender(); }
  function rebuildPieces() { M.pieces = piecesFor(M.keys, M.cols, M.rows); M.parts = E.countParts(M.pieces); }

  /* ---------- Seiten zeichnen ---------- */
  function renderPage() {
    if (!M) return;
    if (S.tab === "mosaic") renderMosaic();
    else if (S.tab === "parts") renderParts();
    else if (S.tab === "steps") renderSteps();
  }

  let geo = null;
  function renderMosaic() {
    const total = M.pieces.length;
    $("stats").innerHTML = `<span><b>${M.cols} × ${M.rows}</b> ${S.mode === "side" ? "Platten" : "Noppen"}</span><span><b>${fmt(M.sizeCm[0])} × ${fmt(M.sizeCm[1])}</b> cm</span><span><b>${total.toLocaleString("de-DE")}</b> Teile</span><span><b>${M.usedKeys.length}</b> Farben</span>`;
    const board = $("board");
    geo = KM.render.draw($("mosaicCanvas"), M, { width: board.clientWidth - 16, maxHeight: Math.max(280, window.innerHeight * 0.6), joints: S.joints, sections: S.mode === "flat" && (M.cols > 16 || M.rows > 16) });
    // Bedienelemente
    document.querySelectorAll(".seg button[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === S.mode ? "true" : "false"));
    $("widthInput").max = S.mode === "side" ? 96 : 128;
    if (document.activeElement !== $("widthInput")) $("widthInput").value = M.cols;
    $("cmOut").textContent = `${fmt(M.sizeCm[0])} cm breit, ${fmt(M.sizeCm[1])} cm hoch`;
    document.querySelectorAll("#widthChips button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.w === M.cols ? "true" : "false"));
    $("partSelect").parentElement.querySelector("select").hidden = S.mode === "side";
    $("partSelect").value = S.part;
    const round = S.mode === "flat" && (S.part === "round" || S.part === "roundtile");
    $("optimize").checked = S.optimize && !round; $("optimize").disabled = round;
    $("optimize").nextElementSibling.textContent = S.mode === "side" ? "Längere Platten (1×2 bis 1×8) verwenden, Fugen versetzt" : round ? "Runde Teile gibt es nur als 1×1" : "Größere Teile verwenden, wo die Farbe gleich bleibt";
    $("jointsToggle").setAttribute("aria-pressed", S.joints ? "true" : "false");
    const sel = S.colors.length;
    $("maxColors").max = sel; $("maxColors").value = S.maxColors && S.maxColors < sel ? S.maxColors : sel;
    $("maxColorsOut").textContent = S.maxColors && S.maxColors < sel ? S.maxColors : "alle";
    $("dither").value = S.dither; $("ditherOut").textContent = S.dither ? S.dither + " %" : "aus";
    renderPalette(); renderBrush();
  }

  function renderPalette() {
    const used = new Set(M.usedKeys);
    $("palette").innerHTML = KM.COLORS.map((c) => `<button type="button" class="pchip${used.has(c.key) ? " used" : ""}" data-k="${c.key}" aria-pressed="${S.colors.includes(c.key)}" title="${c.name} · LEGO ${c.lego}"><i style="background:${c.hex}"></i>${c.de}</button>`).join("");
  }
  $("palette").addEventListener("click", (e) => {
    const b = e.target.closest(".pchip"); if (!b) return;
    const k = b.dataset.k, i = S.colors.indexOf(k);
    if (i >= 0) { if (S.colors.length <= 2) { toast("Mindestens zwei Farben müssen frei bleiben."); return; } S.colors.splice(i, 1); }
    else S.colors.push(k);
    invalidate(); save();
  });
  $("palBasic").addEventListener("click", () => { S.colors = DEFAULTS.colors.slice(); invalidate(); save(); });
  $("palAll").addEventListener("click", () => { S.colors = KM.COLORS.map((c) => c.key); invalidate(); save(); });
  $("palUsed").addEventListener("click", () => { if (M) { S.colors = M.usedKeys.slice(); if (S.colors.length < 2) S.colors.push("white", "black"); S.maxColors = 0; invalidate(); save(); } });

  document.querySelectorAll(".seg button[data-mode]").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; S.step = 1; invalidate(); save(); }));
  $("widthInput").addEventListener("change", (e) => { const v = Math.round(+e.target.value); if (v >= 4) { S.width = v; invalidate(); save(); } });
  $("widthChips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.width = +b.dataset.w; invalidate(); save(); });
  $("partSelect").addEventListener("change", (e) => { S.part = e.target.value; if (S.part === "tile" || S.part === "plate") S.optimize = true; invalidate(); save(); });
  $("optimize").addEventListener("change", (e) => { S.optimize = e.target.checked; invalidate(); save(); });
  $("maxColors").addEventListener("input", (e) => { const v = +e.target.value; S.maxColors = v >= S.colors.length ? 0 : v; $("maxColorsOut").textContent = S.maxColors || "alle"; invalidate(); save(); });
  $("dither").addEventListener("input", (e) => { S.dither = +e.target.value; $("ditherOut").textContent = S.dither ? S.dither + " %" : "aus"; invalidate(); save(); });
  $("jointsToggle").addEventListener("click", () => { S.joints = !S.joints; renderMosaic(); save(); });

  /* ---------- Von Hand ändern ---------- */
  function renderBrush() {
    if (!st.editing) return;
    const keys = [...M.usedKeys, ...S.colors.filter((k) => !M.usedKeys.includes(k))];
    if (!C[st.brush]) st.brush = keys[0];
    $("brushSwatches").innerHTML = keys.map((k) => `<button type="button" data-k="${k}" aria-pressed="${k === st.brush}" title="${C[k].de}" style="background:${C[k].hex}"><span class="sr">${C[k].de}</span></button>`).join("");
  }
  $("brushSwatches").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.brush = b.dataset.k; st.picking = false; $("pickBtn").setAttribute("aria-pressed", "false"); renderBrush(); });
  $("editToggle").addEventListener("click", () => {
    st.editing = !st.editing; $("editToggle").setAttribute("aria-pressed", st.editing ? "true" : "false");
    $("editBar").hidden = !st.editing; $("board").classList.toggle("editing", st.editing);
    $("editToggle").textContent = st.editing ? "Fertig mit Ändern" : "Einzelne Steine ändern";
    renderBrush();
  });
  $("pickBtn").addEventListener("click", () => { st.picking = !st.picking; $("pickBtn").setAttribute("aria-pressed", st.picking ? "true" : "false"); });
  $("undoBtn").addEventListener("click", () => { if (!st.history.length) { toast("Nichts zum Rückgängigmachen."); return; } st.edits = st.history.pop(); invalidate(); save(); });
  $("clearEditsBtn").addEventListener("click", () => { if (!Object.keys(st.edits).length) return; st.history.push({ ...st.edits }); st.edits = {}; invalidate(); save(); toast("Handänderungen verworfen."); });

  const mc = $("mosaicCanvas");
  let painting = false;
  function cellAt(e) {
    const r = mc.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / geo.cw), y = Math.floor((e.clientY - r.top) / geo.ch);
    return x >= 0 && y >= 0 && x < M.cols && y < M.rows ? y * M.cols + x : -1;
  }
  let lastCell = -1;
  function paint(e) {
    const i = cellAt(e); if (i < 0) return;
    if (st.picking) { st.brush = M.keys[i]; st.picking = false; $("pickBtn").setAttribute("aria-pressed", "false"); renderBrush(); painting = false; return; }
    // Linie vom letzten Feld bis hierher füllen, damit schnelles Ziehen keine Lücken lässt
    const cells = [];
    if (lastCell >= 0 && lastCell !== i) {
      let x0 = lastCell % M.cols, y0 = (lastCell / M.cols) | 0; const x1 = i % M.cols, y1 = (i / M.cols) | 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (;;) { cells.push(y0 * M.cols + x0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    } else cells.push(i);
    lastCell = i;
    let changed = false;
    for (const c of cells) if (M.keys[c] !== st.brush) { M.keys[c] = st.brush; st.edits[c] = st.brush; changed = true; }
    if (!changed) return;
    rebuildPieces();
    geo = KM.render.draw(mc, M, { width: $("board").clientWidth - 16, maxHeight: Math.max(280, window.innerHeight * 0.6), joints: S.joints, sections: S.mode === "flat" && (M.cols > 16 || M.rows > 16) });
  }
  mc.addEventListener("pointerdown", (e) => { if (!st.editing || !M) return; st.history.push({ ...st.edits }); if (st.history.length > 50) st.history.shift(); painting = true; lastCell = -1; mc.setPointerCapture(e.pointerId); paint(e); e.preventDefault(); });
  mc.addEventListener("pointermove", (e) => { if (painting) paint(e); });
  const endPaint = () => { if (painting) { painting = false; save(); renderMosaic(); } };
  mc.addEventListener("pointerup", endPaint); mc.addEventListener("pointercancel", endPaint);

  /* ---------- Teileliste ---------- */
  function withReserve(n) { return Math.ceil(n * (1 + S.reserve / 100)); }
  function groupedParts() {
    const by = new Map();
    for (const p of M.parts) { if (!by.has(p.key)) by.set(p.key, []); by.get(p.key).push(p); }
    return M.usedKeys.filter((k) => by.has(k)).map((k) => ({ key: k, items: by.get(k).sort((a, b) => b.part.w * b.part.h - a.part.w * a.part.h) }));
  }
  function renderParts() {
    $("reserve").value = String(S.reserve);
    let total = 0, totalR = 0;
    const html = groupedParts().map((g) => {
      const c = C[g.key];
      const rows = g.items.map((p) => { total += p.n; totalR += withReserve(p.n); return `<div class="prow"><span class="pname">${p.part.name}<small>Teil ${p.part.id}</small></span><span class="pn">${p.n}</span><span class="pr">${withReserve(p.n)}</span></div>`; }).join("");
      return `<div class="pgroup"><div class="phead"><i style="background:${c.hex}"></i><span class="sym">${M.symbols[g.key]}</span><span class="cname">${c.de}<small>${c.name} · LEGO ${c.lego} · BrickLink ${c.bl}</small></span></div>${rows}</div>`;
    }).join("");
    $("partsList").innerHTML = `<div class="prow phdr"><span>Teil</span><span class="pn">genau</span><span class="pr">mit Reserve</span></div>${html}<div class="prow ptotal"><span>Gesamt</span><span class="pn">${total.toLocaleString("de-DE")}</span><span class="pr">${totalR.toLocaleString("de-DE")}</span></div>`;
  }
  $("reserve").addEventListener("change", (e) => { S.reserve = +e.target.value; renderParts(); save(); });

  /* ---------- Anleitung ---------- */
  function steps() {
    if (S.mode === "side") {
      return Array.from({ length: M.rows }, (_, i) => { const layer = i + 1, y = M.rows - layer; return { title: `Lage ${layer}`, region: { x: 0, y, w: M.cols, h: 1 }, y, layer }; });
    }
    const out = [], nx = Math.ceil(M.cols / 16), ny = Math.ceil(M.rows / 16);
    for (let sy = 0; sy < ny; sy++) for (let sx = 0; sx < nx; sx++) {
      const x = sx * 16, y = sy * 16, w = Math.min(16, M.cols - x), h = Math.min(16, M.rows - y);
      out.push({ title: `Abschnitt ${String.fromCharCode(65 + sy)}${sx + 1}`, region: { x, y, w, h }, sub: `Noppen ${x + 1}–${x + w} von links, Reihen ${y + 1}–${y + h} von oben` });
    }
    return out;
  }
  function stepParts(step) {
    const r = step.region, m = new Map(), order = [];
    for (const p of M.pieces) {
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
        if (S.mode === "side") order.push(p);
        const id = p.key + "|" + p.part.id; const e = m.get(id); if (e) e.n++; else m.set(id, { key: p.key, part: p.part, n: 1 });
      }
    }
    return { counts: [...m.values()].sort((a, b) => b.n - a.n), order: order.sort((a, b) => a.x - b.x) };
  }
  function renderSteps() {
    const list = steps(); S.step = Math.max(1, Math.min(list.length, S.step || 1));
    const step = list[S.step - 1];
    $("stepTitle").textContent = step.title;
    $("stepCount").textContent = `${S.step} von ${list.length}`;
    $("stepRange").max = list.length; $("stepRange").value = S.step;
    $("prevStep").disabled = S.step <= 1; $("nextStep").disabled = S.step >= list.length;
    const board = $("stepBoard"), bw = board.clientWidth - 16;
    board.innerHTML = "";
    const sp = stepParts(step);
    if (S.mode === "side") {
      $("stepHint").textContent = step.layer === 1 ? "Erste Lage, ganz unten. Die Zahl auf jeder Platte ist ihre Länge in Noppen." : `Auf Lage ${step.layer - 1} setzen (unten grau). Die Zahl auf jeder Platte ist ihre Länge.`;
      const chunk = M.cols <= 24 ? M.cols : Math.ceil(M.cols / 2);
      for (let x = 0; x < M.cols; x += chunk) {
        const w = Math.min(chunk, M.cols - x);
        const lab = document.createElement("div"); lab.className = "strip-label"; lab.textContent = `Noppe ${x + 1}–${x + w}`; board.appendChild(lab);
        const c = document.createElement("canvas"); board.appendChild(c);
        const ys = step.y + 1 < M.rows ? 2 : 1;
        const cw = bw / chunk;
        KM.render.draw(c, M, { width: cw * w, region: { x, y: step.y, w, h: ys }, joints: true, labels: "length", aspect: 30 / cw, highlight: ys === 2 ? { x, y: step.y, w, h: 1 } : null });
      }
      $("stepParts").innerHTML = `<div class="label">Von links nach rechts</div><div class="order">${sp.order.map((p) => `<span class="ochip"><i style="background:${C[p.key].hex}"></i>1×${p.w} ${C[p.key].de}</span>`).join("")}</div>`;
    } else {
      $("stepHint").textContent = step.sub + (M.cols > 16 || M.rows > 16 ? ". Jeder Abschnitt passt auf eine 16×16-Platte." : ".");
      const c = document.createElement("canvas"); board.appendChild(c);
      KM.render.draw(c, M, { width: bw, maxHeight: Math.max(300, window.innerHeight * 0.6), region: step.region, joints: true, labels: "symbol", symbols: M.symbols });
      $("stepParts").innerHTML = `<div class="label">Teile für diesen Abschnitt</div><div class="order">${sp.counts.map((p) => `<span class="ochip"><i style="background:${C[p.key].hex}"></i><b>${M.symbols[p.key]}</b> ${p.n}× ${p.part.name.replace(/^(Plate|Tile)( Round)? /, "")} ${C[p.key].de}</span>`).join("")}</div>`;
    }
    const ov = $("overviewCanvas");
    const hl = S.mode === "side" ? { x: 0, y: step.y, w: M.cols, h: M.rows - step.y } : step.region;
    KM.render.draw(ov, M, { width: Math.min(260, $("overviewCanvas").parentElement.clientWidth - 16), joints: false, highlight: hl });
  }
  $("prevStep").addEventListener("click", () => { S.step--; renderSteps(); save(); });
  $("nextStep").addEventListener("click", () => { S.step++; renderSteps(); save(); });
  $("stepRange").addEventListener("input", (e) => { S.step = +e.target.value; renderSteps(); save(); });

  /* ---------- Exporte ---------- */
  function partRows() {
    return groupedParts().flatMap((g) => g.items.map((p) => ({ c: C[g.key], sym: M.symbols[g.key], part: p.part, n: p.n, nr: withReserve(p.n) })));
  }
  function download(name, text, type) {
    const blob = text instanceof Blob ? text : new Blob([text], { type });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const fileBase = () => `klemmmosaik-${M.cols}x${M.rows}-${S.mode === "side" ? "stehend" : "flach"}`;
  $("csvBtn").addEventListener("click", () => { ensureModel(); download(fileBase() + ".csv", KM.exporter.csv(partRows()), "text/csv;charset=utf-8"); });
  $("blBtn").addEventListener("click", () => { ensureModel(); $("xmlText").value = KM.exporter.bricklink(partRows()); $("xmlBox").hidden = false; });
  $("xmlCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("xmlText").value); toast("BrickLink-Liste kopiert."); }
    catch (e) { $("xmlText").select(); toast("Text markiert, bitte mit Kopieren übernehmen."); }
  });
  $("xmlDownload").addEventListener("click", () => download(fileBase() + "-bricklink.xml", $("xmlText").value, "application/xml"));
  $("pdfBtn").addEventListener("click", async () => {
    ensureModel();
    const btn = $("pdfBtn"); btn.disabled = true; btn.textContent = "PDF wird erstellt …";
    try {
      const preview = document.createElement("canvas");
      KM.render.draw(preview, M, { width: 900, maxHeight: 900, joints: S.joints });
      const blob = await KM.exporter.pdf(M, { preview: preview.toDataURL("image/png"), parts: partRows(), steps: steps(), stepParts, mode: S.mode, partLabel: S.mode === "side" ? KM.PARTS.side.label : KM.PARTS[S.part].label, reserve: S.reserve });
      download(fileBase() + ".pdf", blob);
    } catch (e) { console.error(e); toast("Das PDF ließ sich nicht erstellen. Bitte noch einmal versuchen."); }
    btn.disabled = false; btn.textContent = "PDF-Anleitung";
  });

  /* ---------- Menü ---------- */
  $("menuBtn").addEventListener("click", () => { const m = $("menu"); m.hidden = !m.hidden; $("menuBtn").setAttribute("aria-expanded", String(!m.hidden)); });
  document.addEventListener("click", (e) => { if (!e.target.closest("#menu") && !e.target.closest("#menuBtn")) { $("menu").hidden = true; $("menuBtn").setAttribute("aria-expanded", "false"); } });
  const updInstall = () => ($("installBtn").hidden = !KM.install.canPrompt || KM.install.standalone);
  KM.install.onChange(updInstall); updInstall();
  $("installBtn").addEventListener("click", () => KM.install.prompt());
  $("aboutBtn").addEventListener("click", () => { $("menu").hidden = true; $("aboutDialog").hidden = false; $("aboutClose").focus(); });
  $("aboutClose").addEventListener("click", () => ($("aboutDialog").hidden = true));
  $("aboutDialog").addEventListener("click", (e) => { if (e.target === $("aboutDialog")) $("aboutDialog").hidden = true; });
  $("newBtn").addEventListener("click", async () => {
    $("menu").hidden = true;
    S = structuredClone(DEFAULTS); st.img = null; st.imgUrl = null; st.edits = {}; st.editSig = ""; st.history = []; st.cellsKey = ""; M = null; dirty = true;
    await KM.store.del("project"); applySettingsToInputs(); showTab("image");
  });

  function applySettingsToInputs() {
    ["brightness", "contrast", "saturation"].forEach((id) => { $(id).value = S.adj[id]; $(id + "Out").textContent = (S.adj[id] > 0 ? "+" : "") + S.adj[id]; });
  }

  window.addEventListener("resize", debounce(() => { if (S.tab === "image") drawCrop(); else renderPage(); }, 150));

  KM.debug = () => ({ M, S, st });

  /* ---------- Start ---------- */
  (async function init() {
    const p = await KM.store.get("project").catch(() => null);
    if (p && p.settings) {
      S = Object.assign(structuredClone(DEFAULTS), p.settings);
      S.adj = Object.assign({ ...DEFAULTS.adj }, S.adj || {});
      S.colors = (S.colors || []).filter((k) => C[k]);
      st.edits = p.edits || {}; st.editSig = p.editSig || "";
    }
    applySettingsToInputs();
    if (p && p.imgUrl) {
      try { await useImage(p.imgUrl, true); } catch (e) { st.img = null; }
    }
    showTab(st.img ? S.tab || "mosaic" : "image");
  })();
})();
