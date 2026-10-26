/* KlemmmosaikBase – Bild zu Mosaik
   1. Bildausschnitt in Zellen aufteilen und jede Zelle in linearem Licht mitteln.
   2. Jede Zelle bekommt die LEGO-Farbe mit dem kleinsten Farbabstand (CIEDE2000 im Lab-Raum).
   3. Optional: Fehlerstreuung (Floyd–Steinberg) und Begrenzung der Farbanzahl.
   4. Gleiche Farben zu größeren Teilen zusammenfassen. */
(function () {
  "use strict";

  /* ---------- Farbräume ---------- */
  const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const toSrgb = (v) => { v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) LIN[i] = toLin(i);

  function linToLab(r, g, b) {
    let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }

  function deltaE2000(a, b) {
    const [L1, a1, b1] = a, [L2, a2, b2] = b;
    const rad = Math.PI / 180;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
    const Cm = (C1 + C2) / 2, Cm7 = Math.pow(Cm, 7);
    const G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 6103515625)));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    let h1p = Math.atan2(b1, a1p) / rad; if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(b2, a2p) / rad; if (h2p < 0) h2p += 360;
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
    const Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
    let hpm = h1p + h2p;
    if (C1p * C2p !== 0) {
      if (Math.abs(h1p - h2p) > 180) hpm = h1p + h2p < 360 ? (hpm + 360) / 2 : (hpm - 360) / 2;
      else hpm /= 2;
    }
    const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad) + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.2 * Math.cos((4 * hpm - 63) * rad);
    const dTheta = 30 * Math.exp(-Math.pow((hpm - 275) / 25, 2));
    const Cpm7 = Math.pow(Cpm, 7);
    const Rc = 2 * Math.sqrt(Cpm7 / (Cpm7 + 6103515625));
    const Sl = 1 + (0.015 * Math.pow(Lpm - 50, 2)) / Math.sqrt(20 + Math.pow(Lpm - 50, 2));
    const Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
    const Rt = -Math.sin(2 * dTheta * rad) * Rc;
    return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
  }

  function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  function buildPalette(keys) {
    return keys.map((k) => {
      const c = KM.COLOR_BY_KEY[k];
      const rgb = hexToRgb(c.hex);
      const lin = rgb.map((v) => LIN[v]);
      return { key: k, rgb, lin, lab: linToLab(lin[0], lin[1], lin[2]) };
    });
  }

  /* ---------- Rasterung ---------- */
  /* Liefert pro Zelle die mittlere Farbe in linearem RGB (Float32Array, 3 Werte je Zelle). */
  function sampleGrid(source, crop, cols, rows, adj) {
    const s = Math.max(2, Math.min(8, Math.floor(1400 / Math.max(cols, rows))));
    const W = cols * s, H = rows * s;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const br = (adj.brightness || 0) * 2.55, ct = 1 + (adj.contrast || 0) / 100, sat = 1 + (adj.saturation || 0) / 100;
    const out = new Float32Array(cols * rows * 3);
    const n = s * s;
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      let R = 0, G = 0, B = 0;
      for (let yy = 0; yy < s; yy++) {
        let i = ((cy * s + yy) * W + cx * s) * 4;
        for (let xx = 0; xx < s; xx++, i += 4) {
          let r = px[i], g = px[i + 1], b = px[i + 2];
          const a = px[i + 3] / 255; // transparente Bereiche werden weiß
          r = r * a + 255 * (1 - a); g = g * a + 255 * (1 - a); b = b * a + 255 * (1 - a);
          if (br || ct !== 1 || sat !== 1) {
            r = (r - 128) * ct + 128 + br; g = (g - 128) * ct + 128 + br; b = (b - 128) * ct + 128 + br;
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
            r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
          }
          R += LIN[r | 0]; G += LIN[g | 0]; B += LIN[b | 0];
        }
      }
      const o = (cy * cols + cx) * 3;
      out[o] = R / n; out[o + 1] = G / n; out[o + 2] = B / n;
    }
    return out;
  }

  /* ---------- Farbzuordnung ---------- */
  function makeMatcher(pal) {
    const cache = new Map();
    return function nearest(r, g, b) {
      const kr = Math.round(Math.max(0, Math.min(1, r)) * 63), kg = Math.round(Math.max(0, Math.min(1, g)) * 63), kb = Math.round(Math.max(0, Math.min(1, b)) * 63);
      const key = (kr << 12) | (kg << 6) | kb;
      let hit = cache.get(key);
      if (hit !== undefined) return hit;
      const lab = linToLab(kr / 63, kg / 63, kb / 63);
      let best = 0, bd = Infinity;
      for (let i = 0; i < pal.length; i++) { const d = deltaE2000(lab, pal[i].lab); if (d < bd) { bd = d; best = i; } }
      cache.set(key, best);
      return best;
    };
  }

  function quantize(cells, cols, rows, pal, dither) {
    const idx = new Uint8Array(cols * rows);
    const nearest = makeMatcher(pal);
    if (!dither) {
      for (let i = 0; i < cols * rows; i++) idx[i] = nearest(cells[i * 3], cells[i * 3 + 1], cells[i * 3 + 2]);
      return idx;
    }
    const buf = Float32Array.from(cells);
    const k = dither; // Stärke 0..1
    for (let y = 0; y < rows; y++) {
      const ltr = y % 2 === 0; // Schlangenlinie gegen Streifenmuster
      for (let j = 0; j < cols; j++) {
        const x = ltr ? j : cols - 1 - j, i = y * cols + x, o = i * 3;
        const r = buf[o], g = buf[o + 1], b = buf[o + 2];
        const p = nearest(r, g, b); idx[i] = p;
        const er = (r - pal[p].lin[0]) * k, eg = (g - pal[p].lin[1]) * k, eb = (b - pal[p].lin[2]) * k;
        const dx = ltr ? 1 : -1;
        const spread = (xx, yy, f) => {
          if (xx < 0 || xx >= cols || yy >= rows) return;
          const q = (yy * cols + xx) * 3; buf[q] += er * f; buf[q + 1] += eg * f; buf[q + 2] += eb * f;
        };
        spread(x + dx, y, 7 / 16); spread(x - dx, y + 1, 3 / 16); spread(x, y + 1, 5 / 16); spread(x + dx, y + 1, 1 / 16);
      }
    }
    return idx;
  }

  /* Farbanzahl begrenzen: nacheinander die Farbe entfernen, deren Wegfall den kleinsten Gesamtfehler erzeugt. */
  function limitColors(cells, cols, rows, pal, maxN) {
    if (!maxN || pal.length <= maxN) return pal;
    const N = cols * rows;
    // Zellen auf Farbgruppen reduzieren (gleiche Farbe = gleiche Zeile der Matrix)
    const groups = new Map();
    for (let i = 0; i < N; i++) {
      const key = (Math.round(cells[i * 3] * 63) << 12) | (Math.round(cells[i * 3 + 1] * 63) << 6) | Math.round(cells[i * 3 + 2] * 63);
      const g = groups.get(key); if (g) g.n++; else groups.set(key, { n: 1, key });
    }
    const G = [...groups.values()];
    const D = G.map((g) => { const lab = linToLab(((g.key >> 12) & 63) / 63, ((g.key >> 6) & 63) / 63, (g.key & 63) / 63); return pal.map((p) => deltaE2000(lab, p.lab)); });
    let active = pal.map((_, i) => i);
    while (active.length > maxN) {
      const cost = new Map(active.map((a) => [a, 0]));
      for (let gi = 0; gi < G.length; gi++) {
        let b1 = Infinity, b2 = Infinity, bi = -1;
        for (const a of active) { const d = D[gi][a]; if (d < b1) { b2 = b1; b1 = d; bi = a; } else if (d < b2) b2 = d; }
        cost.set(bi, cost.get(bi) + (b2 - b1) * G[gi].n);
      }
      let worst = active[0];
      for (const a of active) if (cost.get(a) < cost.get(worst)) worst = a;
      active = active.filter((a) => a !== worst);
    }
    return active.map((i) => pal[i]);
  }

  /* ---------- Teile zusammenfassen ---------- */
  /* Flach: von links oben nach rechts unten das größte passende Rechteck gleicher Farbe setzen. */
  /* block: Teile überschreiten keine Grundplatten-Grenze (alle 16 Noppen), damit jeder Abschnitt einzeln gebaut werden kann. */
  function optimizeFlat(keys, cols, rows, shapes, block) {
    block = block || 16;
    const used = new Uint8Array(cols * rows), pieces = [];
    const opts = [];
    shapes.forEach((s) => { opts.push({ w: s.w, h: s.h, s }); if (s.w !== s.h) opts.push({ w: s.h, h: s.w, s }); });
    opts.sort((a, b) => b.w * b.h - a.w * a.h || b.w - a.w);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x; if (used[i]) continue;
      const k = keys[i];
      for (const o of opts) {
        if (x + o.w > cols || y + o.h > rows) continue;
        if ((x % block) + o.w > block || (y % block) + o.h > block) continue;
        let ok = true;
        for (let yy = y; yy < y + o.h && ok; yy++) for (let xx = x; xx < x + o.w; xx++) { const j = yy * cols + xx; if (used[j] || keys[j] !== k) { ok = false; break; } }
        if (!ok) continue;
        for (let yy = y; yy < y + o.h; yy++) for (let xx = x; xx < x + o.w; xx++) used[yy * cols + xx] = 1;
        pieces.push({ x, y, w: o.w, h: o.h, key: k, part: o.s });
        break;
      }
    }
    return pieces;
  }

  /* Stehend: jede Lage (von unten) in Platten 1×N teilen. Stoßfugen möglichst nicht über einer Fuge der Lage darunter. */
  function optimizeSide(keys, cols, rows, shapes) {
    const lens = shapes.map((s) => s.w).sort((a, b) => b - a);
    const byLen = Object.fromEntries(shapes.map((s) => [s.w, s]));
    const pieces = [];
    let below = new Set();
    for (let y = rows - 1; y >= 0; y--) {
      const joints = new Set();
      let x = 0;
      while (x < cols) {
        const k = keys[y * cols + x];
        let end = x; while (end < cols && keys[y * cols + end] === k) end++;
        let p = x;
        while (p < end) {
          const rest = end - p;
          let pick = null;
          for (const L of lens) {
            if (L > rest) continue;
            const j = p + L;
            if (j === end || j === cols || !below.has(j)) {
              // keinen Rest von genau 0 < r erzwingen, der nur noch mit Fugenkonflikt lösbar ist – einfache Heuristik reicht
              pick = L; break;
            }
          }
          if (pick === null) pick = lens.find((L) => L <= rest);
          pieces.push({ x: p, y, w: pick, h: 1, key: k, part: byLen[pick] });
          p += pick;
          if (p < cols) joints.add(p);
        }
        x = end;
      }
      below = joints;
    }
    return pieces;
  }

  function countParts(pieces) {
    const m = new Map();
    for (const p of pieces) {
      const id = p.key + "|" + p.part.id;
      const e = m.get(id); if (e) e.n++; else m.set(id, { key: p.key, part: p.part, n: 1 });
    }
    return [...m.values()];
  }

  KM.engine = { LIN, toSrgb, linToLab, deltaE2000, hexToRgb, buildPalette, sampleGrid, quantize, limitColors, optimizeFlat, optimizeSide, countParts };
})();
