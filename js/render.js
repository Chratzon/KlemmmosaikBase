/* KlemmmosaikBase – Mosaik auf Canvas zeichnen */
(function () {
  "use strict";
  const BASE = "#262B31";

  function lum(hex) { const [r, g, b] = KM.engine.hexToRgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; }
  function shade(hex, f) {
    const [r, g, b] = KM.engine.hexToRgb(hex);
    const m = (v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* model: { cols, rows, mode, part, keys, pieces }
     opts:  { width (CSS px), region {x,y,w,h} in Zellen, joints, highlight {x,y,w,h}, labels: 'symbol'|'length'|null, symbols: {key: 'A'} } */
  function draw(canvas, model, opts) {
    const reg = opts.region || { x: 0, y: 0, w: model.cols, h: model.rows };
    const aspect = opts.aspect || (model.mode === "side" ? KM.PLATE_MM / KM.STUD_MM : 1);
    let cw = opts.width / reg.w;
    if (opts.maxHeight) cw = Math.min(cw, opts.maxHeight / (reg.h * aspect));
    const ch = cw * aspect;
    const W = Math.max(1, Math.round(cw * reg.w)), H = Math.max(1, Math.round(ch * reg.h));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BASE; ctx.fillRect(0, 0, W, H);

    const C = KM.COLOR_BY_KEY;
    const px = (x) => (x - reg.x) * cw, py = (y) => (y - reg.y) * ch;
    const inReg = (p) => p.x + p.w > reg.x && p.x < reg.x + reg.w && p.y + p.h > reg.y && p.y < reg.y + reg.h;
    const round = model.mode === "flat" && (model.part === "round" || model.part === "roundtile");

    if (!opts.joints) {
      // reines Bild ohne Teilefugen
      for (let y = reg.y; y < reg.y + reg.h; y++) for (let x = reg.x; x < reg.x + reg.w; x++) {
        const hex = C[model.keys[y * model.cols + x]].hex;
        ctx.fillStyle = hex;
        if (round) { ctx.beginPath(); ctx.arc(px(x) + cw / 2, py(y) + ch / 2, cw * 0.47, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(px(x), py(y), cw + 0.5, ch + 0.5);
      }
    } else if (model.mode === "flat") {
      const gap = Math.max(0.5, cw * 0.05);
      for (const p of model.pieces) {
        if (!inReg(p)) continue;
        const hex = C[p.key].hex, x0 = px(p.x), y0 = py(p.y);
        if (round) {
          const cx = x0 + cw / 2, cy = y0 + ch / 2, r = cw * 0.46;
          ctx.fillStyle = hex; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
          if (cw >= 6) { ctx.strokeStyle = shade(hex, 0.28); ctx.lineWidth = Math.max(0.6, cw * 0.05); ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke(); }
        } else {
          ctx.fillStyle = hex; rrect(ctx, x0 + gap, y0 + gap, p.w * cw - 2 * gap, p.h * ch - 2 * gap, cw * 0.08); ctx.fill();
          if (model.part === "plate" && cw >= 6) {
            ctx.strokeStyle = shade(hex, lum(hex) > 200 ? -0.12 : 0.22); ctx.lineWidth = Math.max(0.6, cw * 0.05);
            for (let yy = 0; yy < p.h; yy++) for (let xx = 0; xx < p.w; xx++) { ctx.beginPath(); ctx.arc(x0 + (xx + 0.5) * cw, y0 + (yy + 0.5) * ch, cw * 0.3, 0, Math.PI * 2); ctx.stroke(); }
          }
        }
      }
    } else {
      const gx = Math.max(0.6, cw * 0.06), gy = Math.max(0.5, ch * 0.1);
      for (const p of model.pieces) {
        if (!inReg(p)) continue;
        const hex = C[p.key].hex, x0 = px(p.x), y0 = py(p.y), w = p.w * cw, h = ch;
        ctx.fillStyle = hex; ctx.fillRect(x0 + gx / 2, y0 + gy / 2, w - gx, h - gy);
        if (ch >= 4) { ctx.fillStyle = shade(hex, lum(hex) > 220 ? -0.06 : 0.18); ctx.fillRect(x0 + gx / 2, y0 + gy / 2, w - gx, Math.max(0.6, h * 0.14)); }
      }
    }

    // Beschriftung
    if (opts.labels) {
      const fs = Math.min(cw, ch) * (opts.labels === "length" ? 0.72 : 0.55);
      if (fs >= 6) {
        ctx.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (opts.labels === "length") {
          for (const p of model.pieces) {
            if (!inReg(p)) continue;
            const hex = C[p.key].hex;
            ctx.fillStyle = lum(hex) > 140 ? "rgba(0,0,0,.75)" : "rgba(255,255,255,.9)";
            ctx.fillText(String(p.w), px(p.x) + (p.w * cw) / 2, py(p.y) + ch / 2 + 0.5);
          }
        } else {
          for (let y = reg.y; y < reg.y + reg.h; y++) for (let x = reg.x; x < reg.x + reg.w; x++) {
            const k = model.keys[y * model.cols + x], hex = C[k].hex;
            ctx.fillStyle = lum(hex) > 140 ? "rgba(0,0,0,.72)" : "rgba(255,255,255,.88)";
            ctx.fillText(opts.symbols[k] || "", px(x) + cw / 2, py(y) + ch / 2 + 0.5);
          }
        }
      }
    }

    // Hervorhebung
    if (opts.highlight) {
      const h = opts.highlight;
      ctx.fillStyle = "rgba(10,14,18,.62)";
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(px(h.x), py(h.y), h.w * cw, h.h * ch); ctx.fill("evenodd");
      ctx.strokeStyle = "#FFD23F"; ctx.lineWidth = 2; ctx.strokeRect(px(h.x) + 1, py(h.y) + 1, h.w * cw - 2, h.h * ch - 2);
    }
    // Raster alle 16 Noppen (Grundplatten-Abschnitte) in der flachen Bauweise
    if (opts.sections && model.mode === "flat") {
      ctx.strokeStyle = "rgba(255,210,63,.55)"; ctx.lineWidth = 1;
      for (let x = 16; x < model.cols; x += 16) { ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), H); ctx.stroke(); }
      for (let y = 16; y < model.rows; y += 16) { ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(W, py(y)); ctx.stroke(); }
    }
    return { cw, ch, reg };
  }

  KM.render = { draw, lum };
})();
