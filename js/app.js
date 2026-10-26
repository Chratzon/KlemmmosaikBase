/* KlemmmosaikBase – Oberfläche */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const E = KM.engine;
  const C = KM.COLOR_BY_KEY;
  const EMPTY = "_"; // Handänderung „Feld leer lassen“

  /* ---------- Zustand ---------- */
  const DEFAULTS = {
    aspect: "1:1", crop: null, shape: "rect", poly: null, outside: "empty",
    mode: "flat", width: 32, part: "round", optimize: true,
    colors: KM.COLORS.filter((c) => c.basic).map((c) => c.key),
    maxColors: 0, dither: 0, adj: { brightness: 0, contrast: 0, saturation: 0 },
    joints: true, step: 1, reserve: 10, tab: "image"
  };
  let S = structuredClone(DEFAULTS);
  const st = { img: null, imgUrl: null, edits: {}, editSig: "", history: [], cells: null, mask: null, cellsKey: "", brush: "white", picking: false, editing: false, polySel: -1 };
  let M = null; // aktuelles Mosaik-Modell
  const view = { z: 1, ox: 0, oy: 0, fit: 1, sig: "" };

  /* ---------- Hilfen ---------- */
  let toastT = 0;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2800); }
  const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const fmt = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  function ratio(a) {
    if (S.shape === "poly" || a === "free") return null;
    if (a === "shape") return KM.SHAPES[S.shape].ratio || 1;
    const [w, h] = a.split(":").map(Number); return w / h;
  }
  const save = debounce(() => {
    KM.store.set("project", { settings: S, imgUrl: st.imgUrl, edits: st.edits, editSig: st.editSig }).catch(() => {});
  }, 400);

  /* ---------- Verfügbarkeit ---------- */
  const basePart = () => (S.mode === "side" ? KM.PARTS.side : KM.PARTS[S.part]);
  const baseId = () => basePart().shapes.find((s) => s.w === 1 && s.h === 1).id;
  const availColors = () => KM.COLORS.filter((c) => KM.isAvailable(baseId(), c.key)).map((c) => c.key);
  function effectiveColors() {
    const av = new Set(availColors());
    let sel = S.colors.filter((k) => av.has(k));
    if (sel.length < 2) sel = DEFAULTS.colors.filter((k) => av.has(k));
    return sel;
  }
  function shapesOf(key) {
    const all = basePart().shapes;
    const one = all.filter((s) => s.w === 1 && s.h === 1);
    if (!S.optimize) return one;
    const ok = all.filter((s) => (s.w === 1 && s.h === 1) || KM.isAvailable(s.id, key));
    return ok.length ? ok : one;
  }

  /* ---------- Tabs ---------- */
  function showTab(tab) {
    S.tab = tab;
    document.querySelectorAll(".page").forEach((p) => (p.hidden = p.dataset.page !== tab));
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
    const has = !!st.img;
    document.querySelectorAll(".need-img").forEach((e) => (e.hidden = has));
    document.querySelectorAll(".has-img").forEach((e) => (e.hidden = !has));
    window.scrollTo(0, 0);
    if (tab === "image") { renderShapeUi(); drawCrop(); }
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
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement("canvas");
    cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(im, 0, 0, cv.width, cv.height);
    st.imgUrl = k < 1 || !url.startsWith("data:image/jpeg") ? cv.toDataURL("image/jpeg", 0.9) : url;
    st.img = cv;
    st.cellsKey = "";
    if (!keepCrop || !S.crop) { S.poly = null; if (S.shape === "poly") S.shape = "rect"; fitCrop(); }
    $("emptyState").hidden = true; $("cropArea").hidden = false;
    renderShapeUi(); drawCrop(); invalidate(); save();
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

  /* ---------- Form ---------- */
  function renderShapeUi() {
    $("shapeChips").innerHTML = KM.SHAPE_ORDER.map((k) => `<button type="button" data-s="${k}" aria-pressed="${S.shape === k}"><canvas width="44" height="44" data-icon="${k}" aria-hidden="true"></canvas><span>${KM.SHAPES[k].label}</span></button>`).join("");
    $("shapeChips").querySelectorAll("canvas").forEach((cv) => {
      const k = cv.dataset.icon, c = cv.getContext("2d"), r = KM.SHAPES[k].ratio || 1;
      c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#222";
      const w = r >= 1 ? 32 : 32 * r, h = r >= 1 ? 32 / r : 32;
      if (k === "poly") { c.beginPath(); [[8, 34], [14, 10], [26, 16], [36, 8], [34, 34], [20, 26]].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
      else KM.SHAPES[k].path(c, 22 - w / 2, 22 - h / 2, w, h);
      c.fill();
    });
    const isPoly = S.shape === "poly";
    $("aspectGroup").hidden = isPoly;
    $("aspectShape").hidden = S.shape === "rect";
    $("polyTools").hidden = !isPoly;
    $("cropHint").textContent = isPoly
      ? (S.poly && S.poly.length >= 3 ? "Punkte ziehen, auf eine Kante tippen fügt einen Punkt ein, Fläche ziehen verschiebt die Form." : "Tippe nacheinander die Eckpunkte deiner Form ins Bild, mindestens drei.")
      : "Rahmen verschieben, an den Ecken die Größe ändern. Beim Ziehen zeigt eine Lupe die Stelle vergrößert.";
    $("outsideRow").hidden = S.shape === "rect";
    const av = availColors();
    if (S.outside !== "empty" && !av.includes(S.outside)) S.outside = "empty";
    $("outsideSelect").innerHTML = `<option value="empty">leer lassen</option>` + av.map((k) => `<option value="${k}">mit ${C[k].de} füllen</option>`).join("");
    $("outsideSelect").value = S.outside;
  }
  $("shapeChips").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const k = b.dataset.s; if (k === S.shape) return;
    if (k === "poly") {
      S.shape = "poly";
      const c = S.crop; S.poly = [[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h]];
      st.polySel = -1; polyToCrop();
    } else {
      const wasPoly = S.shape === "poly";
      S.shape = k;
      if (k !== "rect") S.aspect = "shape";
      else if (S.aspect === "shape") S.aspect = "1:1";
      if (wasPoly || k !== "rect") refitCrop();
    }
    renderShapeUi(); drawCrop(); invalidate(); save();
  });
  $("outsideSelect").addEventListener("change", (e) => { S.outside = e.target.value; invalidate(); save(); });
  $("polyDelete").addEventListener("click", () => {
    if (!S.poly || st.polySel < 0) { toast("Tippe zuerst einen Punkt an."); return; }
    if (S.poly.length <= 3) { toast("Eine Form braucht mindestens drei Punkte."); return; }
    S.poly.splice(st.polySel, 1); st.polySel = -1; polyToCrop(); drawCrop(); invalidate(); save();
  });
  $("polyReset").addEventListener("click", () => { S.poly = []; st.polySel = -1; renderShapeUi(); drawCrop(); invalidate(); save(); });

  function polyToCrop() {
    if (!S.poly || S.poly.length < 3) return;
    const xs = S.poly.map((p) => p[0]), ys = S.poly.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    S.crop = { x: x0, y: y0, w: Math.max(8, Math.max(...xs) - x0), h: Math.max(8, Math.max(...ys) - y0) };
  }
  function shapePathFn() {
    if (S.shape === "poly") return S.poly && S.poly.length >= 3 ? KM.polyPath(S.poly, S.crop) : null;
    return KM.SHAPES[S.shape].path;
  }

  /* ---------- Zuschnitt ---------- */
  function fitCrop() {
    const iw = st.img.width, ih = st.img.height, r = ratio(S.aspect);
    let w = iw, h = ih;
    if (r) { if (iw / ih > r) w = ih * r; else h = iw / r; }
    S.crop = { x: (iw - w) / 2, y: (ih - h) / 2, w, h };
  }
  /* Seitenverhältnis ändern, Mittelpunkt und Größe möglichst halten */
  function refitCrop() {
    const r = ratio(S.aspect), k = S.crop, iw = st.img.width, ih = st.img.height;
    if (!r || !k) { if (!k) fitCrop(); return; }
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2, area = k.w * k.h;
    let w = Math.sqrt(area * r), h = w / r;
    const s = Math.min(1, iw / w, ih / h); w *= s; h *= s;
    S.crop = { x: Math.max(0, Math.min(iw - w, cx - w / 2)), y: Math.max(0, Math.min(ih - h, cy - h / 2)), w, h };
  }

  const cv = $("cropCanvas");
  let cropScale = 1, drag = null;
  function drawCrop() {
    if (!st.img) { $("emptyState").hidden = false; $("cropArea").hidden = true; return; }
    $("emptyState").hidden = true; $("cropArea").hidden = false;
    const wrap = $("cropWrap"), maxW = (wrap.clientWidth || 360) - 20, maxH = Math.max(260, window.innerHeight * 0.55);
    cropScale = Math.min(maxW / st.img.width, maxH / st.img.height);
    const W = Math.round(st.img.width * cropScale), H = Math.round(st.img.height * cropScale);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.drawImage(st.img, 0, 0, W, H);
    paintOverlay(c, W, H, cropScale, 0, 0, true);
    if (drag && drag.loupe) drawLoupe(c, W, H);
    document.querySelectorAll("#aspectChips button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.a === S.aspect ? "true" : "false"));
  }
  /* Abdunklung außerhalb der Form, Rahmen und Griffe. sc/tx/ty bilden Bild- auf Canvas-Koordinaten ab. */
  function paintOverlay(c, W, H, sc, tx, ty, handles) {
    const k = S.crop, X = (v) => tx + v * sc, Y = (v) => ty + v * sc;
    const x = X(k.x), y = Y(k.y), w = k.w * sc, h = k.h * sc;
    const isPoly = S.shape === "poly", pts = S.poly || [];
    // Abdunkeln: alles außerhalb der Form
    const dark = new Path2D(); dark.rect(-1e4, -1e4, 3e4, 3e4);
    if (isPoly) { if (pts.length >= 3) { pts.forEach(([px, py], i) => (i ? dark.lineTo(X(px), Y(py)) : dark.moveTo(X(px), Y(py)))); dark.closePath(); } }
    else KM.SHAPES[S.shape].path(pathProxy(dark), x, y, w, h);
    c.fillStyle = "rgba(8,12,16,.62)"; c.fill(dark, "evenodd");
    // Umriss
    c.lineWidth = 2; c.strokeStyle = "#FFD23F";
    if (isPoly) {
      if (pts.length) { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(X(px), Y(py)) : c.moveTo(X(px), Y(py)))); if (pts.length >= 3) c.closePath(); c.stroke(); }
      if (handles) pts.forEach(([px, py], i) => { c.fillStyle = i === st.polySel ? "#FFFFFF" : "#FFD23F"; c.beginPath(); c.arc(X(px), Y(py), i === st.polySel ? 10 : 7, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#1A1A1A"; c.lineWidth = 1.5; c.stroke(); });
    } else {
      if (S.shape !== "rect") { c.save(); c.setLineDash([6, 5]); c.strokeStyle = "rgba(255,210,63,.6)"; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); c.restore(); }
      c.beginPath(); KM.SHAPES[S.shape].path(c, x + 1, y + 1, w - 2, h - 2); c.stroke();
      if (handles && S.shape === "rect") {
        c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1;
        for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x + (w * i) / 3, y); c.lineTo(x + (w * i) / 3, y + h); c.moveTo(x, y + (h * i) / 3); c.lineTo(x + w, y + (h * i) / 3); c.stroke(); }
      }
      if (handles) { c.fillStyle = "#FFD23F"; [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => { c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.fill(); }); }
    }
  }
  /* Formpfade rufen beginPath auf; dieser Adapter leitet sie in ein Path2D um */
  function pathProxy(p) {
    return { beginPath() {}, moveTo: (...a) => p.moveTo(...a), lineTo: (...a) => p.lineTo(...a), closePath: () => p.closePath(), rect: (...a) => p.rect(...a), ellipse: (...a) => p.ellipse(...a), bezierCurveTo: (...a) => p.bezierCurveTo(...a) };
  }

  /* Lupe: zeigt die Umgebung des gezogenen Punkts dreifach vergrößert, versetzt neben dem Finger */
  function drawLoupe(c, W, H) {
    const L = drag.loupe, R = 58, mag = 3;
    let lx = L.cx - 80, ly = L.cy - 90;
    if (ly - R < 0) ly = L.cy + 90;
    if (lx - R < 0) lx = L.cx + 80;
    if (lx + R > W) lx = W - R - 2;
    if (ly + R > H) ly = Math.max(R + 2, L.cy - 90);
    const sc = cropScale * mag, tx = lx - L.ix * sc, ty = ly - L.iy * sc;
    c.save();
    c.beginPath(); c.arc(lx, ly, R, 0, Math.PI * 2); c.clip();
    c.fillStyle = "#111"; c.fillRect(lx - R, ly - R, 2 * R, 2 * R);
    c.imageSmoothingEnabled = false;
    c.drawImage(st.img, tx, ty, st.img.width * sc, st.img.height * sc);
    c.imageSmoothingEnabled = true;
    paintOverlay(c, W * 4, H * 4, sc, tx, ty, false);
    c.strokeStyle = "#FFFFFF"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(lx - 12, ly); c.lineTo(lx + 12, ly); c.moveTo(lx, ly - 12); c.lineTo(lx, ly + 12); c.stroke();
    c.restore();
    c.strokeStyle = "#FFD23F"; c.lineWidth = 3; c.beginPath(); c.arc(lx, ly, R, 0, Math.PI * 2); c.stroke();
  }

  function canvasPoint(e) {
    const r = cv.getBoundingClientRect();
    return { cx: e.clientX - r.left, cy: e.clientY - r.top, ix: Math.max(0, Math.min(st.img.width, (e.clientX - r.left) / cropScale)), iy: Math.max(0, Math.min(st.img.height, (e.clientY - r.top) / cropScale)) };
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return { d: Math.hypot(px - ax - t * dx, py - ay - t * dy), x: ax + t * dx, y: ay + t * dy };
  }
  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  cv.addEventListener("pointerdown", (e) => {
    if (!S.crop || !st.img) return;
    const p = canvasPoint(e), tol = 24 / cropScale;
    if (S.shape === "poly") {
      const pts = S.poly || (S.poly = []);
      let hit = pts.findIndex(([x, y]) => Math.hypot(p.ix - x, p.iy - y) < tol);
      if (hit < 0 && pts.length >= 3) {
        let best = null;
        pts.forEach(([ax, ay], i) => { const [bx, by] = pts[(i + 1) % pts.length]; const s = segDist(p.ix, p.iy, ax, ay, bx, by); if (s.d < tol * 0.7 && (!best || s.d < best.d)) best = { ...s, i }; });
        if (best) { pts.splice(best.i + 1, 0, [best.x, best.y]); hit = best.i + 1; }
      }
      if (hit >= 0) { st.polySel = hit; drag = { type: "point", i: hit, loupe: { ...p, ix: pts[hit][0], iy: pts[hit][1] } }; }
      else if (pts.length >= 3 && inPoly(p.ix, p.iy, pts)) { drag = { type: "polymove", sx: p.ix, sy: p.iy, orig: pts.map((q) => q.slice()) }; }
      else {
        pts.push([p.ix, p.iy]); st.polySel = pts.length - 1;
        drag = { type: "point", i: pts.length - 1, loupe: { ...p } };
        renderShapeUi();
      }
    } else {
      const k = S.crop;
      const corners = [[k.x, k.y], [k.x + k.w, k.y], [k.x, k.y + k.h], [k.x + k.w, k.y + k.h]];
      const ci = corners.findIndex(([cx, cy]) => Math.hypot(p.ix - cx, p.iy - cy) < tol);
      if (ci >= 0) drag = { type: "resize", ci, anchor: corners[3 - ci], loupe: { ...p, ix: corners[ci][0], iy: corners[ci][1] } };
      else if (p.ix > k.x && p.ix < k.x + k.w && p.iy > k.y && p.iy < k.y + k.h) drag = { type: "move", dx: p.ix - k.x, dy: p.iy - k.y };
      else return;
    }
    cv.setPointerCapture(e.pointerId); e.preventDefault(); drawCrop();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = canvasPoint(e), iw = st.img.width, ih = st.img.height;
    if (drag.type === "point") {
      S.poly[drag.i] = [p.ix, p.iy]; drag.loupe = { ...p }; polyToCrop();
    } else if (drag.type === "polymove") {
      let dx = p.ix - drag.sx, dy = p.iy - drag.sy;
      const xs = drag.orig.map((q) => q[0]), ys = drag.orig.map((q) => q[1]);
      dx = Math.max(-Math.min(...xs), Math.min(iw - Math.max(...xs), dx)); dy = Math.max(-Math.min(...ys), Math.min(ih - Math.max(...ys), dy));
      S.poly = drag.orig.map(([x, y]) => [x + dx, y + dy]); polyToCrop();
    } else if (drag.type === "move") {
      const k = S.crop;
      k.x = Math.max(0, Math.min(iw - k.w, p.ix - drag.dx)); k.y = Math.max(0, Math.min(ih - k.h, p.iy - drag.dy));
    } else {
      const k = S.crop, [ax, ay] = drag.anchor, rr = ratio(S.aspect), min = Math.max(12, Math.min(iw, ih) * 0.04);
      let w = Math.abs(p.ix - ax), h = Math.abs(p.iy - ay);
      const sx = p.ix < ax ? -1 : 1, sy = p.iy < ay ? -1 : 1;
      const maxW = sx < 0 ? ax : iw - ax, maxH = sy < 0 ? ay : ih - ay;
      if (rr) { w = Math.max(w, h * rr); w = Math.min(w, maxW, maxH * rr); h = w / rr; if (w < min) { w = min; h = w / rr; } }
      else { w = Math.max(min, Math.min(w, maxW)); h = Math.max(min, Math.min(h, maxH)); }
      k.w = w; k.h = h; k.x = sx < 0 ? ax - w : ax; k.y = sy < 0 ? ay - h : ay;
      drag.loupe = { ...p, ix: sx < 0 ? k.x : k.x + k.w, iy: sy < 0 ? k.y : k.y + k.h };
    }
    drawCrop();
  });
  const endDrag = () => { if (drag) { drag = null; drawCrop(); renderShapeUi(); invalidate(); save(); } };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  $("aspectChips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.aspect = b.dataset.a; refitCrop(); drawCrop(); invalidate(); save(); });

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
  function sig(cols, rows) {
    const k = S.crop, poly = S.shape === "poly" && S.poly ? S.poly.map((p) => (p[0] | 0) + "," + (p[1] | 0)).join(";") : "";
    return [S.mode, cols, rows, k.x | 0, k.y | 0, k.w | 0, k.h | 0, S.shape, poly].join("|");
  }
  function piecesFor(keys, cols, rows) {
    return S.mode === "side" ? E.optimizeSide(keys, cols, rows, shapesOf) : E.optimizeFlat(keys, cols, rows, shapesOf, 16);
  }
  function compute() {
    if (!st.img) { M = null; return; }
    if (S.shape === "poly") polyToCrop();
    const { cols, rows } = dims();
    const sp = S.shape === "rect" ? null : shapePathFn();
    const path = sp ? (ctx, W, H) => sp(ctx, 0, 0, W, H) : null;
    const ck = JSON.stringify([S.crop, S.adj, cols, rows, S.shape, S.shape === "poly" ? S.poly : 0]);
    if (ck !== st.cellsKey) { const r = E.sampleGrid(st.img, S.crop, cols, rows, S.adj, path); st.cells = r.cells; st.mask = r.mask; st.cellsKey = ck; }
    const sel = effectiveColors();
    let pal = E.buildPalette(sel);
    if (S.maxColors && S.maxColors < pal.length) pal = E.limitColors(st.cells, cols, rows, pal, S.maxColors, st.mask);
    const idx = E.quantize(st.cells, cols, rows, pal, S.dither / 100);
    const fill = S.outside !== "empty" && C[S.outside] ? S.outside : null;
    const keys = Array.from(idx, (i, n) => (st.mask && !st.mask[n] ? fill : pal[i].key));
    const sg = sig(cols, rows);
    if (st.editSig !== sg) {
      if (Object.keys(st.edits).length) toast("Größe, Form oder Ausschnitt geändert, Handänderungen wurden verworfen.");
      st.edits = {}; st.history = []; st.editSig = sg;
    }
    for (const i in st.edits) { if (i >= keys.length) continue; const v = st.edits[i]; if (v === EMPTY) keys[i] = null; else if (C[v]) keys[i] = v; }
    M = { cols, rows, mode: S.mode, part: S.mode === "side" ? "side" : S.part, keys, pieces: piecesFor(keys, cols, rows) };
    finishModel();
    M.sizeCm = [cols * KM.STUD_MM / 10, rows * (S.mode === "side" ? KM.PLATE_MM : KM.STUD_MM) / 10];
    if (view.sig !== cols + "x" + rows + S.mode) { view.sig = cols + "x" + rows + S.mode; view.z = 1; }
  }
  function finishModel() {
    M.parts = E.countParts(M.pieces);
    const cnt = {}; for (const k of M.keys) if (k != null) cnt[k] = (cnt[k] || 0) + 1;
    M.usedKeys = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
    M.symbols = {}; M.usedKeys.forEach((k, i) => (M.symbols[k] = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(97 + i - 26)));
    M.groups = S.mode === "side" && M.pieces.length ? E.sideComponents(M.pieces, M.rows) : 1;
  }
  let dirty = true;
  function ensureModel() { if (dirty) { compute(); dirty = false; } }
  const rerender = debounce(() => { if (S.tab !== "image" && st.img) { ensureModel(); renderPage(); } }, 140);
  function invalidate() { dirty = true; rerender(); }
  function rebuildPieces() { M.pieces = piecesFor(M.keys, M.cols, M.rows); finishModel(); }

  /* ---------- Seiten zeichnen ---------- */
  function renderPage() {
    if (!M) return;
    if (S.tab === "mosaic") renderMosaic();
    else if (S.tab === "parts") renderParts();
    else if (S.tab === "steps") renderSteps();
  }

  /* --- Vorschau mit Zoom --- */
  let geo = null;
  const aspectOf = () => (M.mode === "side" ? KM.PLATE_MM / KM.STUD_MM : 1);
  function clampView() {
    const b = $("board"), W = b.clientWidth, H = b.clientHeight;
    view.fit = Math.min(W / M.cols, H / (M.rows * aspectOf()));
    view.maxZ = Math.max(1, 64 / view.fit);
    view.z = Math.max(1, Math.min(view.maxZ, view.z));
    const sc = view.fit * view.z, gw = M.cols * sc, gh = M.rows * sc * aspectOf();
    view.ox = gw <= W ? (W - gw) / 2 : Math.min(0, Math.max(W - gw, view.ox));
    view.oy = gh <= H ? (H - gh) / 2 : Math.min(0, Math.max(H - gh, view.oy));
    return { W, H, sc };
  }
  function drawPreview() {
    if (!M) return;
    const { W, H, sc } = clampView();
    geo = KM.render.draw($("mosaicCanvas"), M, { view: { W, H, scale: sc, ox: view.ox, oy: view.oy }, joints: S.joints, sections: S.mode === "flat" && (M.cols > 16 || M.rows > 16) });
    $("zoomLevel").textContent = Math.round(view.z * 100) + " %";
    $("zoomOut").disabled = view.z <= 1.001; $("zoomIn").disabled = view.z >= view.maxZ - 0.001; $("zoomFit").disabled = view.z <= 1.001;
  }
  function zoomAt(f, cx, cy) {
    const old = view.fit * view.z;
    view.z = Math.max(1, Math.min(view.maxZ || 8, view.z * f));
    const sc = view.fit * view.z;
    view.ox = cx - ((cx - view.ox) / old) * sc; view.oy = cy - ((cy - view.oy) / old) * sc;
    drawPreview();
  }
  $("zoomIn").addEventListener("click", () => { const b = $("board"); zoomAt(1.6, b.clientWidth / 2, b.clientHeight / 2); });
  $("zoomOut").addEventListener("click", () => { const b = $("board"); zoomAt(1 / 1.6, b.clientWidth / 2, b.clientHeight / 2); });
  $("zoomFit").addEventListener("click", () => { view.z = 1; drawPreview(); });

  function renderMosaic() {
    const total = M.pieces.length;
    $("stats").innerHTML = `<span><b>${M.cols} × ${M.rows}</b> ${S.mode === "side" ? "Platten" : "Noppen"}</span><span><b>${fmt(M.sizeCm[0])} × ${fmt(M.sizeCm[1])}</b> cm</span><span><b>${total.toLocaleString("de-DE")}</b> Teile</span><span><b>${M.usedKeys.length}</b> Farben</span>`;
    setBarHeight();
    drawPreview();
    const w = $("warn");
    if (S.mode === "side" && M.groups > 1) { w.hidden = false; w.textContent = `Das Bild besteht aus ${M.groups} getrennten Teilstücken, die keine Platte miteinander verbindet. Eine Rückwand oder Trägerplatte ist nötig.`; }
    else w.hidden = true;
    document.querySelectorAll(".seg button[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === S.mode ? "true" : "false"));
    $("widthInput").max = S.mode === "side" ? 96 : 128;
    if (document.activeElement !== $("widthInput")) $("widthInput").value = M.cols;
    $("cmOut").textContent = `${fmt(M.sizeCm[0])} cm breit, ${fmt(M.sizeCm[1])} cm hoch`;
    document.querySelectorAll("#widthChips button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.w === M.cols ? "true" : "false"));
    $("partSelect").hidden = S.mode === "side";
    $("partSelect").value = S.part;
    const round = S.mode === "flat" && (S.part === "round" || S.part === "roundtile");
    $("optimize").checked = S.optimize && !round; $("optimize").disabled = round;
    $("optimize").nextElementSibling.textContent = S.mode === "side" ? "Längere Platten (1×2 bis 1×8) verwenden, Fugen versetzt" : round ? "Runde Teile gibt es nur als 1×1" : "Größere Teile verwenden, wo die Farbe gleich bleibt";
    $("jointsToggle").setAttribute("aria-pressed", S.joints ? "true" : "false");
    const sel = effectiveColors().length;
    $("maxColors").max = sel; $("maxColors").value = S.maxColors && S.maxColors < sel ? S.maxColors : sel;
    $("maxColorsOut").textContent = S.maxColors && S.maxColors < sel ? S.maxColors : "alle";
    $("dither").value = S.dither; $("ditherOut").textContent = S.dither ? S.dither + " %" : "aus";
    const bp = basePart().shapes.find((s) => s.w === 1 && s.h === 1);
    $("availHint").textContent = `Angezeigt werden nur Farben, in denen LEGO das Teil ${bp.name.replace("Plate", "Platte").replace("Tile", "Fliese").replace("Round", "rund")} (${bp.id}) hergestellt hat. Größere Teile kommen nur in Farben zum Einsatz, in denen es sie gibt.`;
    renderPalette(); renderBrush();
  }
  function setBarHeight() { document.documentElement.style.setProperty("--bar-h", document.querySelector(".bar").offsetHeight + "px"); }

  function renderPalette() {
    const used = new Set(M.usedKeys), av = availColors(), eff = new Set(effectiveColors());
    $("palette").innerHTML = av.map((k) => { const c = C[k]; return `<button type="button" class="pchip${used.has(k) ? " used" : ""}" data-k="${k}" aria-pressed="${eff.has(k)}" title="${c.name} · LEGO ${c.lego}"><i style="background:${c.hex}"></i>${c.de}</button>`; }).join("");
  }
  $("palette").addEventListener("click", (e) => {
    const b = e.target.closest(".pchip"); if (!b) return;
    const k = b.dataset.k;
    S.colors = effectiveColors();
    const i = S.colors.indexOf(k);
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
  $("maxColors").addEventListener("input", (e) => { const v = +e.target.value; S.maxColors = v >= effectiveColors().length ? 0 : v; $("maxColorsOut").textContent = S.maxColors || "alle"; invalidate(); save(); });
  $("dither").addEventListener("input", (e) => { S.dither = +e.target.value; $("ditherOut").textContent = S.dither ? S.dither + " %" : "aus"; invalidate(); save(); });
  $("jointsToggle").addEventListener("click", () => { S.joints = !S.joints; $("jointsToggle").setAttribute("aria-pressed", S.joints ? "true" : "false"); drawPreview(); save(); });

  /* --- Von Hand ändern --- */
  function renderBrush() {
    if (!st.editing) return;
    const av = availColors();
    const keys = [...M.usedKeys, ...av.filter((k) => !M.usedKeys.includes(k))];
    if (st.brush !== EMPTY && !C[st.brush]) st.brush = keys[0];
    $("brushSwatches").innerHTML = `<button type="button" class="empty-sw" data-k="${EMPTY}" aria-pressed="${st.brush === EMPTY}" title="Feld leeren"><span class="sr">Feld leeren</span></button>` +
      keys.map((k) => `<button type="button" data-k="${k}" aria-pressed="${k === st.brush}" title="${C[k].de}" style="background:${C[k].hex}"><span class="sr">${C[k].de}</span></button>`).join("");
  }
  $("brushSwatches").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.brush = b.dataset.k; st.picking = false; $("pickBtn").setAttribute("aria-pressed", "false"); renderBrush(); });
  $("editToggle").addEventListener("click", () => {
    st.editing = !st.editing; $("editToggle").setAttribute("aria-pressed", st.editing ? "true" : "false");
    $("editBar").hidden = !st.editing; $("board").classList.toggle("editing", st.editing);
    $("editToggle").textContent = st.editing ? "Fertig" : "Steine ändern";
    $("toolHint").textContent = st.editing ? "Ein Finger malt, zwei Finger zoomen und verschieben" : "Ziehen verschiebt, zwei Finger zoomen";
    renderBrush();
  });
  $("pickBtn").addEventListener("click", () => { st.picking = !st.picking; $("pickBtn").setAttribute("aria-pressed", st.picking ? "true" : "false"); });
  $("undoBtn").addEventListener("click", () => { if (!st.history.length) { toast("Nichts zum Rückgängigmachen."); return; } st.edits = st.history.pop(); invalidate(); save(); });
  $("clearEditsBtn").addEventListener("click", () => { if (!Object.keys(st.edits).length) return; st.history.push({ ...st.edits }); st.edits = {}; invalidate(); save(); toast("Handänderungen verworfen."); });

  /* --- Gesten auf der Vorschau: 1 Finger malt (Bearbeiten) oder verschiebt, 2 Finger zoomen --- */
  const mc = $("mosaicCanvas");
  const ptrs = new Map();
  let gest = null, lastCell = -1;
  function local(e) { const r = mc.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function cellAtLocal(p) {
    const x = Math.floor((p.x - geo.ox) / geo.cw), y = Math.floor((p.y - geo.oy) / geo.ch);
    return x >= 0 && y >= 0 && x < M.cols && y < M.rows ? y * M.cols + x : -1;
  }
  function paintAt(p) {
    const i = cellAtLocal(p); if (i < 0) return;
    if (st.picking) { st.brush = M.keys[i] == null ? EMPTY : M.keys[i]; st.picking = false; $("pickBtn").setAttribute("aria-pressed", "false"); renderBrush(); gest = null; return; }
    const cells = [];
    if (lastCell >= 0 && lastCell !== i) {
      let x0 = lastCell % M.cols, y0 = (lastCell / M.cols) | 0; const x1 = i % M.cols, y1 = (i / M.cols) | 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (;;) { cells.push(y0 * M.cols + x0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    } else cells.push(i);
    lastCell = i;
    const val = st.brush === EMPTY ? null : st.brush;
    let changed = false;
    for (const c of cells) if (M.keys[c] !== val) { M.keys[c] = val; st.edits[c] = st.brush; changed = true; }
    if (!changed) return;
    rebuildPieces(); drawPreview();
  }
  function startPinch() {
    const [a, b] = [...ptrs.values()];
    gest = { type: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z0: view.z, ox0: view.ox, oy0: view.oy };
  }
  mc.addEventListener("pointerdown", (e) => {
    if (!M) return;
    ptrs.set(e.pointerId, local(e)); mc.setPointerCapture(e.pointerId); e.preventDefault();
    if (ptrs.size === 2) {
      if (gest && gest.type === "paint") { // Malstrich abbrechen, das war ein Zoom
        st.edits = gest.before; st.history.pop(); invalidate(); ensureModel();
      }
      startPinch(); return;
    }
    if (ptrs.size > 2) return;
    const p = local(e);
    if (st.editing) {
      gest = { type: "paint", before: { ...st.edits } }; st.history.push({ ...st.edits }); if (st.history.length > 50) st.history.shift();
      lastCell = -1; paintAt(p);
    } else gest = { type: "pan", sx: p.x, sy: p.y, ox0: view.ox, oy0: view.oy };
  });
  mc.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const p = local(e); ptrs.set(e.pointerId, p);
    if (!gest) return;
    if (gest.type === "pinch" && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const old = view.fit * gest.z0;
      view.z = Math.max(1, Math.min(view.maxZ, gest.z0 * (d / gest.d0)));
      const sc = view.fit * view.z;
      view.ox = m.x - ((gest.m0.x - gest.ox0) / old) * sc; view.oy = m.y - ((gest.m0.y - gest.oy0) / old) * sc;
      drawPreview();
    } else if (gest.type === "pan") { view.ox = gest.ox0 + p.x - gest.sx; view.oy = gest.oy0 + p.y - gest.sy; drawPreview(); }
    else if (gest.type === "paint") paintAt(p);
  });
  function endPtr(e) {
    ptrs.delete(e.pointerId);
    if (gest && gest.type === "paint" && ptrs.size === 0) { save(); renderMosaic(); }
    if (ptrs.size === 0) gest = null;
    else if (ptrs.size === 1 && gest && gest.type === "pinch") { const p = [...ptrs.values()][0]; gest = st.editing ? null : { type: "pan", sx: p.x, sy: p.y, ox0: view.ox, oy0: view.oy }; }
  }
  mc.addEventListener("pointerup", endPtr); mc.addEventListener("pointercancel", endPtr);
  mc.addEventListener("wheel", (e) => { if (!M) return; e.preventDefault(); const p = local(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y); }, { passive: false });

  /* ---------- Teileliste ---------- */
  function withReserve(n) { return Math.ceil(n * (1 + S.reserve / 100)); }
  function groupedParts() {
    const by = new Map();
    for (const p of M.parts) { if (!by.has(p.key)) by.set(p.key, []); by.get(p.key).push(p); }
    return M.usedKeys.filter((k) => by.has(k)).map((k) => ({ key: k, items: by.get(k).sort((a, b) => b.part.w * b.part.h - a.part.w * a.part.h) }));
  }
  function renderParts() {
    $("reserve").value = String(S.reserve);
    let total = 0, totalR = 0, rare = 0;
    const html = groupedParts().map((g) => {
      const c = C[g.key];
      const rows = g.items.map((p) => {
        total += p.n; totalR += withReserve(p.n);
        const r = KM.isRare(p.part.id, g.key); if (r) rare++;
        return `<div class="prow"><span class="pname">${p.part.name}<small>Teil ${p.part.id}${r ? ' · <em class="rare">selten</em>' : ""}</small></span><span class="pn">${p.n}</span><span class="pr">${withReserve(p.n)}</span></div>`;
      }).join("");
      return `<div class="pgroup"><div class="phead"><i style="background:${c.hex}"></i><span class="sym">${M.symbols[g.key]}</span><span class="cname">${c.de}<small>${c.name} · LEGO ${c.lego} · BrickLink ${c.bl}</small></span></div>${rows}</div>`;
    }).join("");
    const note = rare ? `<p class="hint">„Selten“ heißt: LEGO hat dieses Teil in dieser Farbe nur in wenigen Sets verbaut. Es ist erhältlich, aber oft teurer oder in kleiner Stückzahl.</p>` : "";
    $("partsList").innerHTML = `<div class="prow phdr"><span>Teil</span><span class="pn">genau</span><span class="pr">mit Reserve</span></div>${html}<div class="prow ptotal"><span>Gesamt</span><span class="pn">${total.toLocaleString("de-DE")}</span><span class="pr">${totalR.toLocaleString("de-DE")}</span></div>${note}`;
  }
  $("reserve").addEventListener("change", (e) => { S.reserve = +e.target.value; renderParts(); save(); });

  /* ---------- Anleitung ---------- */
  function steps() {
    const hasCells = (r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (M.keys[y * M.cols + x] != null) return true; return false; };
    if (S.mode === "side") {
      const out = []; let layer = 0;
      for (let y = M.rows - 1; y >= 0; y--) {
        const region = { x: 0, y, w: M.cols, h: 1 };
        if (!hasCells(region)) continue;
        layer++; out.push({ title: `Lage ${layer}`, region, y, layer });
      }
      return out;
    }
    const out = [], nx = Math.ceil(M.cols / 16), ny = Math.ceil(M.rows / 16);
    for (let sy = 0; sy < ny; sy++) for (let sx = 0; sx < nx; sx++) {
      const x = sx * 16, y = sy * 16, w = Math.min(16, M.cols - x), h = Math.min(16, M.rows - y);
      const region = { x, y, w, h };
      if (!hasCells(region)) continue;
      out.push({ title: `Abschnitt ${String.fromCharCode(65 + sy)}${sx + 1}`, region, sub: `Noppen ${x + 1}–${x + w} von links, Reihen ${y + 1}–${y + h} von oben` });
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
    const list = steps();
    if (!list.length) { $("stepTitle").textContent = "Keine Schritte"; $("stepBoard").innerHTML = ""; return; }
    S.step = Math.max(1, Math.min(list.length, S.step || 1));
    const step = list[S.step - 1];
    $("stepTitle").textContent = step.title;
    $("stepCount").textContent = `${S.step} von ${list.length}`;
    $("stepRange").max = list.length; $("stepRange").value = S.step;
    $("prevStep").disabled = S.step <= 1; $("nextStep").disabled = S.step >= list.length;
    const board = $("stepBoard"), bw = board.clientWidth - 16;
    board.innerHTML = "";
    const sp = stepParts(step);
    if (S.mode === "side") {
      // Leerstellen links und rechts mitzählen, damit man die Startposition findet
      const first = sp.order.length ? sp.order[0].x : 0;
      $("stepHint").textContent = (step.layer === 1 ? "Erste Lage, ganz unten." : `Auf Lage ${step.layer - 1} setzen (unten gedimmt).`) + (first > 0 ? ` Beginnt bei Noppe ${first + 1} von links.` : "") + " Die Zahl auf jeder Platte ist ihre Länge.";
      const chunk = M.cols <= 24 ? M.cols : Math.ceil(M.cols / 2);
      for (let x = 0; x < M.cols; x += chunk) {
        const w = Math.min(chunk, M.cols - x);
        const lab = document.createElement("div"); lab.className = "strip-label"; lab.textContent = `Noppe ${x + 1}–${x + w}`; board.appendChild(lab);
        const c = document.createElement("canvas"); board.appendChild(c);
        const ys = step.y + 1 < M.rows ? 2 : 1;
        const cw = bw / chunk;
        KM.render.draw(c, M, { width: cw * w, region: { x, y: step.y, w, h: ys }, joints: true, labels: "length", aspect: 30 / cw, highlight: ys === 2 ? { x, y: step.y, w, h: 1 } : null });
      }
      $("stepParts").innerHTML = `<div class="label">Von links nach rechts</div><div class="order">${sp.order.map((p, i) => { const gap = p.x - (i ? sp.order[i - 1].x + sp.order[i - 1].w : 0); return (gap > 0 ? `<span class="ochip gap">${gap} frei</span>` : "") + `<span class="ochip"><i style="background:${C[p.key].hex}"></i>1×${p.w} ${C[p.key].de}</span>`; }).join("")}</div>`;
    } else {
      $("stepHint").textContent = step.sub + (M.cols > 16 || M.rows > 16 ? ". Jeder Abschnitt passt auf eine 16×16-Platte." : ".");
      const c = document.createElement("canvas"); board.appendChild(c);
      KM.render.draw(c, M, { width: bw, maxHeight: Math.max(300, window.innerHeight * 0.6), region: step.region, joints: true, labels: "symbol", symbols: M.symbols });
      $("stepParts").innerHTML = `<div class="label">Teile für diesen Abschnitt</div><div class="order">${sp.counts.map((p) => `<span class="ochip"><i style="background:${C[p.key].hex}"></i><b>${M.symbols[p.key]}</b> ${p.n}× ${p.part.name.replace(/^(Plate|Tile)( Round)? /, "")} ${C[p.key].de}</span>`).join("")}</div>`;
    }
    const ov = $("overviewCanvas");
    const hl = S.mode === "side" ? { x: 0, y: step.y, w: M.cols, h: M.rows - step.y } : step.region;
    KM.render.draw(ov, M, { width: Math.min(260, ov.parentElement.clientWidth - 16), joints: false, highlight: hl });
  }
  $("prevStep").addEventListener("click", () => { S.step--; renderSteps(); save(); });
  $("nextStep").addEventListener("click", () => { S.step++; renderSteps(); save(); });
  $("stepRange").addEventListener("input", (e) => { S.step = +e.target.value; renderSteps(); save(); });

  /* ---------- Exporte ---------- */
  function partRows() {
    return groupedParts().flatMap((g) => g.items.map((p) => ({ c: C[g.key], sym: M.symbols[g.key], part: p.part, n: p.n, nr: withReserve(p.n), rare: KM.isRare(p.part.id, g.key) })));
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
      const blob = await KM.exporter.pdf(M, { preview: preview.toDataURL("image/png"), parts: partRows(), steps: steps(), stepParts, mode: S.mode, partLabel: S.mode === "side" ? KM.PARTS.side.label : KM.PARTS[S.part].label, reserve: S.reserve, groups: M.groups });
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

  window.addEventListener("resize", debounce(() => { setBarHeight(); if (S.tab === "image") drawCrop(); else renderPage(); }, 150));

  KM.debug = () => ({ M, S, st, view });

  /* ---------- Start ---------- */
  (async function init() {
    const p = await KM.store.get("project").catch(() => null);
    if (p && p.settings) {
      S = Object.assign(structuredClone(DEFAULTS), p.settings);
      S.adj = Object.assign({ ...DEFAULTS.adj }, S.adj || {});
      S.colors = (S.colors || []).filter((k) => C[k]);
      if (!KM.SHAPES[S.shape]) S.shape = "rect";
      st.edits = p.edits || {}; st.editSig = p.editSig || "";
    }
    applySettingsToInputs(); setBarHeight();
    if (p && p.imgUrl) {
      try { await useImage(p.imgUrl, true); } catch (e) { st.img = null; }
    }
    showTab(st.img ? S.tab || "mosaic" : "image");
  })();
})();
