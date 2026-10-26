/* KlemmmosaikBase – Formen für den Bildausschnitt.
   Jede Form zeichnet ihren Umriss in ein Rechteck (x, y, w, h). ratio = natürliches Breite/Höhe-Verhältnis. */
(function () {
  "use strict";
  const poly = (pts) => (ctx, x, y, w, h) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + px * w, y + py * h)); ctx.closePath(); };

  // Stern: Punkte berechnen und auf das Rechteck normieren
  const starPts = (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.4 : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { pts: pts.map(([a, b]) => [(a - x0) / (x1 - x0), (b - y0) / (y1 - y0)]), ratio: (x1 - x0) / (y1 - y0) };
  })();
  const k = 1 - Math.SQRT1_2; // Achteck mit gleich langen Seiten

  KM.SHAPES = {
    rect: { label: "Rechteck", ratio: null, path: (ctx, x, y, w, h) => { ctx.beginPath(); ctx.rect(x, y, w, h); } },
    circle: { label: "Kreis", ratio: 1, path: (ctx, x, y, w, h) => { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); } },
    hex: { label: "Sechseck", ratio: 2 / Math.sqrt(3), path: poly([[0, 0.5], [0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1]]) },
    hexv: { label: "Sechseck hoch", ratio: Math.sqrt(3) / 2, path: poly([[0.5, 0], [1, 0.25], [1, 0.75], [0.5, 1], [0, 0.75], [0, 0.25]]) },
    oct: { label: "Achteck", ratio: 1, path: poly([[k, 0], [1 - k, 0], [1, k], [1, 1 - k], [1 - k, 1], [k, 1], [0, 1 - k], [0, k]]) },
    heart: {
      label: "Herz", ratio: 1.08,
      path: (ctx, x, y, w, h) => {
        const P = (px, py) => [x + px * w, y + py * h];
        ctx.beginPath(); ctx.moveTo(...P(0.5, 1));
        ctx.bezierCurveTo(...P(0.42, 0.9), ...P(0, 0.62), ...P(0, 0.3));
        ctx.bezierCurveTo(...P(0, 0.1), ...P(0.14, 0), ...P(0.28, 0));
        ctx.bezierCurveTo(...P(0.4, 0), ...P(0.48, 0.08), ...P(0.5, 0.18));
        ctx.bezierCurveTo(...P(0.52, 0.08), ...P(0.6, 0), ...P(0.72, 0));
        ctx.bezierCurveTo(...P(0.86, 0), ...P(1, 0.1), ...P(1, 0.3));
        ctx.bezierCurveTo(...P(1, 0.62), ...P(0.58, 0.9), ...P(0.5, 1));
        ctx.closePath();
      }
    },
    star: { label: "Stern", ratio: starPts.ratio, path: poly(starPts.pts) },
    poly: { label: "Eigene Form", ratio: null, path: null }
  };
  KM.SHAPE_ORDER = ["rect", "circle", "hex", "hexv", "oct", "heart", "star", "poly"];

  /* Pfad einer eigenen Form: Punkte in Bildkoordinaten, abgebildet über das Rechteck crop → (x, y, w, h) */
  KM.polyPath = (pts, crop) => (ctx, x, y, w, h) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => { const X = x + ((px - crop.x) / crop.w) * w, Y = y + ((py - crop.y) / crop.h) * h; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
    ctx.closePath();
  };
})();
