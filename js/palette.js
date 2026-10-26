/* KlemmmosaikBase – Farbpalette und Teilekatalog
   Farbwerte: Näherung der echten Steinfarben (Rebrickable/BrickLink-Referenz).
   lego = offizielle LEGO-Farbnummer, bl = BrickLink-Farb-ID.
   Nicht jede Farbe gibt es in jeder Form; die App warnt nicht pro Teil, siehe README. */
window.KM = window.KM || {};

KM.COLORS = [
  { key: "white",  name: "White",               de: "Weiß",            lego: 1,   bl: 1,   hex: "#FFFFFF", basic: true },
  { key: "lbg",    name: "Light Bluish Gray",   de: "Hellgrau",        lego: 194, bl: 86,  hex: "#A0A5A9", basic: true },
  { key: "dbg",    name: "Dark Bluish Gray",    de: "Dunkelgrau",      lego: 199, bl: 85,  hex: "#6C6E68", basic: true },
  { key: "black",  name: "Black",               de: "Schwarz",         lego: 26,  bl: 11,  hex: "#1B1D1F", basic: true },
  { key: "red",    name: "Red",                 de: "Rot",             lego: 21,  bl: 5,   hex: "#C91A09", basic: true },
  { key: "dred",   name: "Dark Red",            de: "Dunkelrot",       lego: 154, bl: 59,  hex: "#720E0F", basic: true },
  { key: "orange", name: "Orange",              de: "Orange",          lego: 106, bl: 4,   hex: "#FE8A18", basic: true },
  { key: "blo",    name: "Bright Light Orange", de: "Hellorange",      lego: 191, bl: 110, hex: "#F8BB3D", basic: true },
  { key: "yellow", name: "Yellow",              de: "Gelb",            lego: 24,  bl: 3,   hex: "#F2CD37", basic: true },
  { key: "bly",    name: "Bright Light Yellow", de: "Hellgelb",        lego: 226, bl: 103, hex: "#FFF03A", basic: false },
  { key: "lime",   name: "Lime",                de: "Limette",         lego: 119, bl: 34,  hex: "#BBE90B", basic: true },
  { key: "bgreen", name: "Bright Green",        de: "Hellgrün",        lego: 37,  bl: 36,  hex: "#4B9F4A", basic: true },
  { key: "green",  name: "Green",               de: "Grün",            lego: 28,  bl: 6,   hex: "#237841", basic: true },
  { key: "dgreen", name: "Dark Green",          de: "Dunkelgrün",      lego: 141, bl: 80,  hex: "#184632", basic: true },
  { key: "olive",  name: "Olive Green",         de: "Olivgrün",        lego: 330, bl: 155, hex: "#9B9A5A", basic: false },
  { key: "sgreen", name: "Sand Green",          de: "Sandgrün",        lego: 151, bl: 48,  hex: "#A0BCAC", basic: false },
  { key: "dturq",  name: "Dark Turquoise",      de: "Dunkeltürkis",    lego: 107, bl: 39,  hex: "#008F9B", basic: true },
  { key: "mazure", name: "Medium Azure",        de: "Azur",            lego: 322, bl: 156, hex: "#36AEBF", basic: true },
  { key: "laqua",  name: "Light Aqua",          de: "Hellaqua",        lego: 323, bl: 152, hex: "#ADC3C0", basic: false },
  { key: "dazure", name: "Dark Azure",          de: "Dunkelazur",      lego: 321, bl: 153, hex: "#078BC9", basic: true },
  { key: "blb",    name: "Bright Light Blue",   de: "Hellblau",        lego: 212, bl: 105, hex: "#9FC3E9", basic: false },
  { key: "mblue",  name: "Medium Blue",         de: "Mittelblau",      lego: 102, bl: 42,  hex: "#5A93DB", basic: true },
  { key: "blue",   name: "Blue",                de: "Blau",            lego: 23,  bl: 7,   hex: "#0055BF", basic: true },
  { key: "dblue",  name: "Dark Blue",           de: "Dunkelblau",      lego: 140, bl: 63,  hex: "#0A3463", basic: true },
  { key: "sblue",  name: "Sand Blue",           de: "Sandblau",        lego: 135, bl: 55,  hex: "#6074A1", basic: false },
  { key: "dpurp",  name: "Dark Purple",         de: "Dunkellila",      lego: 268, bl: 89,  hex: "#3F3691", basic: false },
  { key: "mlav",   name: "Medium Lavender",     de: "Lavendel",        lego: 324, bl: 157, hex: "#AC78BA", basic: false },
  { key: "lav",    name: "Lavender",            de: "Hell-Lavendel",   lego: 325, bl: 154, hex: "#E1D5ED", basic: false },
  { key: "magenta",name: "Magenta",             de: "Magenta",         lego: 124, bl: 71,  hex: "#923978", basic: false },
  { key: "dpink",  name: "Dark Pink",           de: "Dunkelrosa",      lego: 221, bl: 47,  hex: "#C870A0", basic: true },
  { key: "bpink",  name: "Bright Pink",         de: "Rosa",            lego: 222, bl: 104, hex: "#E4ADC8", basic: true },
  { key: "coral",  name: "Coral",               de: "Koralle",         lego: 353, bl: 220, hex: "#FF698F", basic: false },
  { key: "lnoug",  name: "Light Nougat",        de: "Hautfarbe hell",  lego: 283, bl: 90,  hex: "#F6D7B3", basic: true },
  { key: "nougat", name: "Nougat",              de: "Nougat",          lego: 18,  bl: 28,  hex: "#D09168", basic: true },
  { key: "mnoug",  name: "Medium Nougat",       de: "Mittelnougat",    lego: 312, bl: 150, hex: "#AA7D55", basic: true },
  { key: "tan",    name: "Tan",                 de: "Beige",           lego: 5,   bl: 2,   hex: "#E4CD9E", basic: true },
  { key: "dtan",   name: "Dark Tan",            de: "Dunkelbeige",     lego: 138, bl: 69,  hex: "#958A73", basic: true },
  { key: "dorange",name: "Dark Orange",         de: "Dunkelorange",    lego: 38,  bl: 68,  hex: "#A95500", basic: false },
  { key: "rbrown", name: "Reddish Brown",       de: "Rotbraun",        lego: 192, bl: 88,  hex: "#582A12", basic: true },
  { key: "dbrown", name: "Dark Brown",          de: "Dunkelbraun",     lego: 308, bl: 120, hex: "#352100", basic: false }
];
KM.COLOR_BY_KEY = Object.fromEntries(KM.COLORS.map((c) => [c.key, c]));

/* Teile je Bauweise. w×h in Noppen (flach) bzw. Länge (stehend). */
KM.PARTS = {
  round: { label: "1×1 runde Platten", short: "rund", shapes: [{ w: 1, h: 1, id: "4073", name: "Plate Round 1×1" }] },
  roundtile: { label: "1×1 runde Fliesen", short: "runde Fliese", shapes: [{ w: 1, h: 1, id: "98138", name: "Tile Round 1×1" }] },
  tile: {
    label: "Fliesen (glatt)", short: "Fliese",
    shapes: [
      { w: 2, h: 4, id: "87079", name: "Tile 2×4" },
      { w: 2, h: 3, id: "26603", name: "Tile 2×3" },
      { w: 2, h: 2, id: "3068b", name: "Tile 2×2" },
      { w: 1, h: 4, id: "2431", name: "Tile 1×4" },
      { w: 1, h: 3, id: "63864", name: "Tile 1×3" },
      { w: 1, h: 2, id: "3069b", name: "Tile 1×2" },
      { w: 1, h: 1, id: "3070b", name: "Tile 1×1" }
    ]
  },
  plate: {
    label: "Platten (mit Noppen)", short: "Platte",
    shapes: [
      { w: 2, h: 4, id: "3020", name: "Plate 2×4" },
      { w: 2, h: 3, id: "3021", name: "Plate 2×3" },
      { w: 2, h: 2, id: "3022", name: "Plate 2×2" },
      { w: 1, h: 4, id: "3710", name: "Plate 1×4" },
      { w: 1, h: 3, id: "3623", name: "Plate 1×3" },
      { w: 1, h: 2, id: "3023", name: "Plate 1×2" },
      { w: 1, h: 1, id: "3024", name: "Plate 1×1" }
    ]
  },
  side: {
    label: "Platten liegend gestapelt", short: "Platte",
    shapes: [
      { w: 8, h: 1, id: "3460", name: "Plate 1×8" },
      { w: 6, h: 1, id: "3666", name: "Plate 1×6" },
      { w: 4, h: 1, id: "3710", name: "Plate 1×4" },
      { w: 3, h: 1, id: "3623", name: "Plate 1×3" },
      { w: 2, h: 1, id: "3023", name: "Plate 1×2" },
      { w: 1, h: 1, id: "3024", name: "Plate 1×1" }
    ]
  }
};

/* Maße in mm */
KM.STUD_MM = 8;
KM.PLATE_MM = 3.2;
