/* KlemmmosaikBase – Exporte: CSV, BrickLink-Wunschliste, PDF-Anleitung */
(function () {
  "use strict";
  const JSPDF_URL = "js/vendor/jspdf.umd.min.js"; // jsPDF 2.5.1, MIT-Lizenz, lokal mitgeliefert

  function csv(rows) {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Symbol", "Farbe", "Farbe (englisch)", "LEGO-Farbnr.", "BrickLink-Farbe", "Teil", "Teilenummer", "Anzahl", "Anzahl mit Reserve"];
    const lines = rows.map((r) => [r.sym, r.c.de, r.c.name, r.c.lego, r.c.bl, r.part.name, r.part.id, r.n, r.nr].map(q).join(";"));
    return "﻿" + [head.map(q).join(";"), ...lines].join("\r\n");
  }

  function bricklink(rows) {
    const items = rows.map((r) => `  <ITEM>\n    <ITEMTYPE>P</ITEMTYPE>\n    <ITEMID>${r.part.id}</ITEMID>\n    <COLOR>${r.c.bl}</COLOR>\n    <MINQTY>${r.nr}</MINQTY>\n  </ITEM>`);
    return `<INVENTORY>\n${items.join("\n")}\n</INVENTORY>`;
  }

  let libP = null;
  function loadJsPdf() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    if (!libP) libP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = JSPDF_URL;
      s.onload = () => (window.jspdf ? res(window.jspdf) : rej(new Error("jsPDF fehlt")));
      s.onerror = () => { libP = null; rej(new Error("jsPDF nicht geladen")); };
      document.head.appendChild(s);
    });
    return libP;
  }

  const rgb = (hex) => KM.engine.hexToRgb(hex);
  const light = (hex) => KM.render.lum(hex) > 140;

  async function pdf(M, o) {
    const { jsPDF } = await loadJsPdf();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PW = 210, PH = 297, MG = 14;
    const C = KM.COLOR_BY_KEY;
    const sizeTxt = `${M.cols} × ${M.rows} ${o.mode === "side" ? "Platten" : "Noppen"} · ${M.sizeCm[0].toFixed(1).replace(".", ",")} × ${M.sizeCm[1].toFixed(1).replace(".", ",")} cm`;
    const footer = (n) => { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120); doc.text(`KlemmmosaikBase · ${sizeTxt}`, MG, PH - 8); doc.text(String(n), PW - MG, PH - 8, { align: "right" }); doc.setTextColor(0); };
    let page = 1;

    /* Deckblatt */
    doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text("Mosaik-Bauanleitung", MG, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.text(sizeTxt, MG, 34);
    doc.text(`${o.mode === "side" ? "Stehend gebaut" : "Flach gebaut"} · ${o.partLabel} · ${M.pieces.length} Teile · ${M.usedKeys.length} Farben`, MG, 40);
    if (o.groups > 1) { doc.setTextColor(170, 60, 0); doc.text(`Achtung: ${o.groups} getrennte Teilstücke, Rückwand oder Trägerplatte nötig.`, MG, 45); doc.setTextColor(0); }
    const img = new Image(); img.src = o.preview; await img.decode().catch(() => {});
    const maxW = PW - 2 * MG, maxH = 150, k = Math.min(maxW / img.width, maxH / img.height);
    doc.addImage(o.preview, "PNG", MG + (maxW - img.width * k) / 2, 50, img.width * k, img.height * k);
    let y = 50 + img.height * k + 10;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Farben", MG, y); y += 6;
    doc.setFontSize(9);
    const colW = (PW - 2 * MG) / 3;
    M.usedKeys.forEach((key, i) => {
      const c = C[key], cx = MG + (i % 3) * colW, cy = y + Math.floor(i / 3) * 7;
      if (cy > PH - 20) return;
      doc.setFillColor(...rgb(c.hex)); doc.setDrawColor(150); doc.rect(cx, cy - 4, 5, 5, "FD");
      doc.setFont("helvetica", "bold"); doc.text(M.symbols[key], cx + 7, cy);
      doc.setFont("helvetica", "normal"); doc.text(`${c.de} (${c.name})`, cx + 12, cy);
    });
    footer(page);

    /* Teileliste */
    doc.addPage(); page++;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Teileliste", MG, 22);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Mit ${o.reserve} % Reserve. Farbnummern nach LEGO und BrickLink. * = selten, nur in wenigen Sets verbaut.`, MG, 28);
    y = 38;
    const cols = [MG, MG + 8, MG + 60, MG + 82, MG + 104, MG + 140, MG + 160];
    const head = () => {
      doc.setFont("helvetica", "bold");
      ["", "Farbe", "LEGO-Nr.", "BrickLink", "Teil", "Teilenr.", "Anzahl"].forEach((t, i) => doc.text(t, cols[i], y));
      doc.setDrawColor(180); doc.line(MG, y + 2, PW - MG, y + 2); y += 7; doc.setFont("helvetica", "normal");
    };
    head();
    let total = 0;
    o.parts.forEach((r) => {
      if (y > PH - 20) { footer(page); doc.addPage(); page++; y = 22; head(); }
      doc.setFillColor(...rgb(r.c.hex)); doc.setDrawColor(150); doc.rect(cols[0], y - 3.6, 4.5, 4.5, "FD");
      doc.text(`${r.sym}  ${r.c.de}`, cols[1], y); doc.text(String(r.c.lego), cols[2], y); doc.text(String(r.c.bl), cols[3], y);
      doc.text(r.part.name + (r.rare ? " *" : ""), cols[4], y); doc.text(r.part.id, cols[5], y); doc.text(String(r.nr), cols[6], y);
      total += r.nr; y += 6;
    });
    doc.setFont("helvetica", "bold"); doc.line(MG, y - 3, PW - MG, y - 3); doc.text("Gesamt", cols[1], y + 2); doc.text(String(total), cols[6], y + 2);
    footer(page);

    /* Bauschritte */
    if (o.mode === "side") {
      // Lagen von unten nach oben, je Seite ein Block; unten auf der Seite die unterste Lage
      const per = 14, availW = PW - 2 * MG - 12, cw = availW / M.cols, lh = 12;
      for (let start = 0; start < o.steps.length; start += per) {
        doc.addPage(); page++;
        const block = o.steps.slice(start, start + per);
        doc.setFont("helvetica", "bold"); doc.setFontSize(14);
        doc.text(`Lagen ${block[0].layer}–${block[block.length - 1].layer}`, MG, 20);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.text("Von unten nach oben bauen. Zahl = Länge der Platte in Noppen. Lage 1 liegt ganz unten.", MG, 25);
        block.forEach((st, i) => {
          const yy = PH - 26 - i * (lh + 4);
          doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(String(st.layer), MG + 8, yy + lh / 2 + 1, { align: "right" });
          const { order } = o.stepParts(st);
          order.forEach((p) => {
            const x = MG + 12 + p.x * cw, c = C[p.key];
            doc.setFillColor(...rgb(c.hex)); doc.setDrawColor(90); doc.setLineWidth(0.2);
            doc.rect(x, yy, p.w * cw, lh, "FD");
            if (p.w * cw >= 3) {
              doc.setTextColor(light(c.hex) ? 0 : 255); doc.setFontSize(Math.min(9, p.w * cw * 2.2));
              doc.text(String(p.w), x + (p.w * cw) / 2, yy + lh / 2 + 1.2, { align: "center" });
              doc.setFontSize(5.5); doc.text(M.symbols[p.key], x + (p.w * cw) / 2, yy + lh - 1.2, { align: "center" });
              doc.setTextColor(0);
            }
          });
        });
        footer(page);
      }
    } else {
      o.steps.forEach((st) => {
        doc.addPage(); page++;
        const r = st.region;
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(st.title, MG, 20);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(st.sub, MG, 25);
        // kleine Übersicht mit Lage des Abschnitts
        const ow = 34, ocw = ow / Math.max(M.cols, M.rows);
        const ox = PW - MG - ow, oy = 12;
        doc.setDrawColor(150); doc.setFillColor(235); doc.rect(ox, oy, M.cols * ocw, M.rows * ocw, "FD");
        doc.setFillColor(255, 210, 63); doc.rect(ox + r.x * ocw, oy + r.y * ocw, r.w * ocw, r.h * ocw, "F");
        const size = PW - 2 * MG, cs = size / 16, top = 52;
        doc.setFillColor(38, 43, 49); doc.rect(MG, top, r.w * cs, r.h * cs, "F");
        for (let yy = 0; yy < r.h; yy++) for (let xx = 0; xx < r.w; xx++) {
          const key = M.keys[(r.y + yy) * M.cols + (r.x + xx)];
          if (key == null) continue;
          const c = C[key];
          const x = MG + xx * cs, yv = top + yy * cs;
          doc.setFillColor(...rgb(c.hex));
          if (M.part === "round" || M.part === "roundtile") doc.circle(x + cs / 2, yv + cs / 2, cs * 0.46, "F");
          else doc.rect(x + 0.3, yv + 0.3, cs - 0.6, cs - 0.6, "F");
          doc.setTextColor(light(c.hex) ? 30 : 245); doc.setFontSize(8); doc.setFont("helvetica", "bold");
          doc.text(M.symbols[key], x + cs / 2, yv + cs / 2 + 1, { align: "center" });
        }
        doc.setTextColor(0);
        // Teilefugen bei größeren Teilen
        doc.setDrawColor(255, 210, 63); doc.setLineWidth(0.5);
        M.pieces.forEach((p) => { if ((p.w > 1 || p.h > 1) && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) doc.rect(MG + (p.x - r.x) * cs + 0.4, top + (p.y - r.y) * cs + 0.4, p.w * cs - 0.8, p.h * cs - 0.8, "S"); });
        doc.setLineWidth(0.2);
        // Teile dieses Abschnitts
        const { counts } = o.stepParts(st);
        let ty = top + r.h * cs + 8;
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("Teile für diesen Abschnitt", MG, ty); ty += 5;
        doc.setFont("helvetica", "normal");
        counts.forEach((p, i) => {
          const cx = MG + (i % 3) * 62, cy = ty + Math.floor(i / 3) * 5.5;
          if (cy > PH - 14) return;
          doc.setFillColor(...rgb(C[p.key].hex)); doc.setDrawColor(150); doc.rect(cx, cy - 3.2, 3.8, 3.8, "FD");
          doc.text(`${M.symbols[p.key]}  ${p.n}× ${p.part.name.replace(/^(Plate|Tile)( Round)? /, "")} ${C[p.key].de}`, cx + 5.5, cy);
        });
        footer(page);
      });
    }
    return doc.output("blob");
  }

  KM.exporter = { csv, bricklink, pdf };
})();
