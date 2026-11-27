import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/* ---------- Schema dei collegamenti audio (config/collegamenti) ---------- */

export interface Porta {
  id: string;
  label: string;
}

export interface Dispositivo {
  id: string;
  nome: string;
  gruppo: string; // musicista o "MIXER" / "MONITOR"
  colonna: number; // 0 strumenti · 1 effetti/ampli/synth · 2 mixer batteria · 3 X18 · 4 in-ear e spie
  ingressi: Porta[];
  uscite: Porta[];
  /** canali con nome modificabile (mixer) */
  canali?: boolean;
}

export interface Capo {
  dev: string;
  porta: string;
}

export interface Cavo {
  id: string;
  da: Capo;
  a: Capo;
  nome: string;
}

export interface Collegamenti {
  cavi: Cavo[];
  /** nome dei canali dei mixer: chiave "dev:porta" */
  canali: Record<string, string>;
  aggiornato?: string;
}

const porte = (prefisso: string, n: number, label: (i: number) => string): Porta[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefisso}${i + 1}`, label: label(i + 1) }));

const out = (label = "Uscita"): Porta[] => [{ id: "out", label }];
const inn = (label = "Ingresso"): Porta[] => [{ id: "in", label }];

export const MUSICISTI = ["SBERLA", "PHIL", "CEKKO", "WALTER", "GIULIO"];

export const DISPOSITIVI: Dispositivo[] = [
  // --- Colonna 0: sorgenti ---
  { id: "mic1", nome: "Mic 1 · Shure Beta 58", gruppo: "SBERLA", colonna: 0, ingressi: [], uscite: out("Ricevitore ULXD4") },
  { id: "mic2", nome: "Mic 2 · Sennheiser XSW 835", gruppo: "SBERLA", colonna: 0, ingressi: [], uscite: out("Ricevitore") },
  { id: "chitarra", nome: "Chitarra", gruppo: "PHIL", colonna: 0, ingressi: [], uscite: out("Jack") },
  { id: "micPhil", nome: "Mic cori chitarrista · SM58", gruppo: "PHIL", colonna: 0, ingressi: [], uscite: out("XLR") },
  { id: "basso", nome: "Basso", gruppo: "WALTER", colonna: 0, ingressi: [], uscite: out("Jack") },
  { id: "take5", nome: "Sequential Take5", gruppo: "CEKKO", colonna: 0, ingressi: [], uscite: out() },
  { id: "moog", nome: "Moog Little Phatty II", gruppo: "CEKKO", colonna: 0, ingressi: [], uscite: out() },
  { id: "microkorg", nome: "Korg Microkorg", gruppo: "CEKKO", colonna: 0, ingressi: [], uscite: out("Mono") },
  { id: "micCekko", nome: "Mic cori tastierista", gruppo: "CEKKO", colonna: 0, ingressi: [], uscite: out("XLR") },
  {
    id: "batteria",
    nome: "Batteria (microfoni)",
    gruppo: "GIULIO",
    colonna: 0,
    ingressi: [],
    uscite: [
      { id: "cassa", label: "Cassa" },
      { id: "rullante", label: "Rullante" },
      { id: "tom1", label: "Tom 1" },
      { id: "tom2", label: "Tom 2" },
      { id: "timpano", label: "Timpano" },
      { id: "hh", label: "Charleston" },
      { id: "ohl", label: "Overhead L" },
      { id: "ohr", label: "Overhead R" },
    ],
  },
  { id: "pad", nome: "Alesis SamplePad", gruppo: "GIULIO", colonna: 0, ingressi: [], uscite: out() },

  // --- Colonna 1: effetti, amplificazione, workstation ---
  { id: "fxVoce", nome: "Pedaliera voce · TC-Helicon", gruppo: "SBERLA", colonna: 1, ingressi: inn("Mic in"), uscite: out("Out") },
  { id: "fxChitarra", nome: "Pedaliera chitarra", gruppo: "PHIL", colonna: 1, ingressi: inn(), uscite: out() },
  { id: "cassaChitarra", nome: "Cassa chitarra · Laney", gruppo: "PHIL", colonna: 1, ingressi: inn(), uscite: out("XLR") },
  { id: "fxBasso", nome: "Pedaliera basso · Zoom B6", gruppo: "WALTER", colonna: 1, ingressi: inn(), uscite: [{ id: "out", label: "Out" }, { id: "xlr", label: "XLR" }] },
  { id: "ampliBasso", nome: "Ampli basso", gruppo: "WALTER", colonna: 1, ingressi: inn(), uscite: out("DI") },
  {
    id: "nautilus",
    nome: "Korg Nautilus",
    gruppo: "CEKKO",
    colonna: 1,
    ingressi: [
      { id: "in1", label: "In 1" },
      { id: "in2", label: "In 2" },
    ],
    uscite: [
      { id: "l", label: "L" },
      { id: "r", label: "R" },
      { id: "click", label: "Click" },
      { id: "samuel", label: "Samuel" },
      { id: "cori", label: "Cori" },
      { id: "drum", label: "Drum machine" },
    ],
  },

  // --- Colonna 2: mixer batteria ---
  {
    id: "mixBatteria",
    nome: "Mixer batteria",
    gruppo: "MIXER",
    colonna: 2,
    canali: true,
    ingressi: porte("in", 10, (i) => `In ${i}`),
    uscite: [
      { id: "l", label: "Main L" },
      { id: "r", label: "Main R" },
      { id: "cuffie", label: "Cuffie" },
    ],
  },

  // --- Colonna 3: Behringer X18 ---
  {
    id: "x18",
    nome: "Behringer X18",
    gruppo: "MIXER",
    colonna: 3,
    canali: true,
    ingressi: porte("in", 18, (i) => `Ch ${i}`),
    uscite: [...porte("aux", 6, (i) => `Aux ${i}`), { id: "cuffie", label: "Cuffie" }],
  },

  // --- Colonna 4: ascolto ---
  ...MUSICISTI.map((m) => ({ id: `iem${m}`, nome: `In-ear ${m}`, gruppo: "MONITOR", colonna: 4, ingressi: inn(), uscite: [] })),
  ...[1, 2, 3, 4, 5].map((i) => ({
    id: `spia${i}`,
    nome: `Spia ${i}`,
    gruppo: "MONITOR",
    colonna: 4,
    ingressi: inn(),
    uscite: i < 5 ? out("Link") : [],
  })),
];

export const dispositivo = (id: string) => DISPOSITIVI.find((d) => d.id === id);

export function etichetta(c: Capo, canali: Record<string, string>) {
  const d = dispositivo(c.dev);
  const p = [...(d?.ingressi ?? []), ...(d?.uscite ?? [])].find((x) => x.id === c.porta);
  const nomeCanale = canali[`${c.dev}:${c.porta}`];
  const porta = p ? (nomeCanale ? `${p.label} «${nomeCanale}»` : p.label) : c.porta;
  return `${d?.nome ?? c.dev} · ${porta}`;
}

let seq = 0;
export const nuovoId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

const cavo = (da: string, a: string, nome: string): Cavo => {
  const [dd, dp] = da.split(".");
  const [ad, ap] = a.split(".");
  return { id: `def-${dd}-${dp}-${ad}-${ap}`, da: { dev: dd, porta: dp }, a: { dev: ad, porta: ap }, nome };
};

/** Collegamenti di partenza, ricavati dalla scheda tecnica (modificabili dalla band). */
export function predefiniti(): Collegamenti {
  const cavi: Cavo[] = [
    cavo("mic1.out", "x18.in1", "Voce pulita"),
    cavo("mic2.out", "fxVoce.in", "Voce verso effetti"),
    cavo("fxVoce.out", "x18.in2", "Voce con effetti"),
    cavo("chitarra.out", "fxChitarra.in", "Chitarra"),
    cavo("fxChitarra.out", "cassaChitarra.in", "Chitarra effettata"),
    cavo("cassaChitarra.out", "x18.in3", "Chitarra XLR"),
    cavo("micPhil.out", "x18.in4", "Voce cori Phil"),
    cavo("basso.out", "fxBasso.in", "Basso"),
    cavo("fxBasso.out", "ampliBasso.in", "Basso verso ampli"),
    cavo("fxBasso.xlr", "x18.in5", "Basso XLR (Canon)"),
    cavo("take5.out", "nautilus.in1", "Take5"),
    cavo("moog.out", "nautilus.in2", "Moog"),
    cavo("nautilus.l", "x18.in6", "Tastiere L"),
    cavo("nautilus.r", "x18.in7", "Tastiere R"),
    cavo("nautilus.click", "x18.in8", "Click"),
    cavo("nautilus.samuel", "x18.in9", "Samuel"),
    cavo("nautilus.cori", "x18.in10", "Cori"),
    cavo("nautilus.drum", "x18.in11", "Drum machine"),
    cavo("microkorg.out", "x18.in12", "Microkorg"),
    cavo("micCekko.out", "x18.in15", "Voce cori Cekko"),
    ...["cassa", "rullante", "tom1", "tom2", "timpano", "hh", "ohl", "ohr"].map((p, i) =>
      cavo(`batteria.${p}`, `mixBatteria.in${i + 1}`, ["Cassa", "Rullante", "Tom 1", "Tom 2", "Timpano", "Charleston", "Overhead L", "Overhead R"][i]),
    ),
    cavo("pad.out", "mixBatteria.in9", "Alesis SamplePad"),
    cavo("mixBatteria.l", "x18.in13", "Batteria L"),
    cavo("mixBatteria.r", "x18.in14", "Batteria R"),
    ...MUSICISTI.map((m, i) => cavo(`x18.aux${i + 1}`, `iem${m}.in`, `In-ear ${m}`)),
    cavo("x18.cuffie", "spia1.in", "Spie (cuffie X18)"),
    ...[1, 2, 3, 4].map((i) => cavo(`spia${i}.out`, `spia${i + 1}.in`, `Cascata spia ${i} → ${i + 1}`)),
  ];
  const canali: Record<string, string> = {};
  for (const c of cavi) {
    const d = dispositivo(c.a.dev);
    if (d?.canali) canali[`${c.a.dev}:${c.a.porta}`] = c.nome;
  }
  MUSICISTI.forEach((m, i) => (canali[`x18:aux${i + 1}`] = m));
  canali["x18:aux6"] = "";
  return { cavi, canali };
}

export const REF_COLLEGAMENTI = () => doc(db(), "config", "collegamenti");

export const salvaCollegamenti = (c: Partial<Collegamenti>) =>
  setDoc(REF_COLLEGAMENTI(), { ...c, aggiornato: new Date().toISOString() }, { merge: true });

/* ---------- Disposizione dello schema (coordinate SVG) ---------- */

export const COLORI: Record<string, string> = {
  SBERLA: "#e0457b",
  PHIL: "#f08c2e",
  WALTER: "#2f9e44",
  CEKKO: "#3b82f6",
  GIULIO: "#9b5de5",
  MIXER: "#0f9fb5",
  MONITOR: "#6b7280",
};

export const COL_X = [10, 250, 500, 740, 1020];
export const COL_W = [190, 190, 180, 210, 170];
const RIGA = 17;
const TESTA = 24;
const GAP = 14;

export interface Box {
  d: Dispositivo;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function disposizione() {
  const boxes: Box[] = [];
  const altezze = [0, 0, 0, 0, 0];
  for (let col = 0; col < 5; col++) {
    let y = 58;
    for (const d of DISPOSITIVI.filter((x) => x.colonna === col)) {
      const righe = Math.max(d.ingressi.length, d.uscite.length, 1);
      const h = TESTA + righe * RIGA + 6;
      boxes.push({ d, x: COL_X[col], y, w: COL_W[col], h });
      y += h + GAP;
    }
    altezze[col] = y;
  }
  // il mixer batteria va all'altezza della batteria
  const bat = boxes.find((b) => b.d.id === "batteria");
  const mb = boxes.find((b) => b.d.id === "mixBatteria");
  if (bat && mb) mb.y = Math.max(58, bat.y - 20);
  const altezza = Math.max(...boxes.map((b) => b.y + b.h)) + 20;
  return { boxes, larghezza: COL_X[4] + COL_W[4] + 10, altezza };
}

export function puntoPorta(b: Box, porta: string, lato: "in" | "out") {
  const lista = lato === "in" ? b.d.ingressi : b.d.uscite;
  const i = Math.max(0, lista.findIndex((p) => p.id === porta));
  return { x: lato === "in" ? b.x : b.x + b.w, y: b.y + TESTA + i * RIGA + RIGA / 2 };
}

/** Cavo da un'uscita (p1) a un ingresso (p2). Se l'ingresso è nella stessa colonna o più a sinistra,
 *  il cavo gira attorno ai riquadri passando nello spazio sopra il dispositivo di arrivo (yPassaggio). */
export function percorso(p1: { x: number; y: number }, p2: { x: number; y: number }, yPassaggio?: number) {
  if (p2.x > p1.x + 20) {
    const dx = Math.max(40, (p2.x - p1.x) / 2);
    return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
  }
  const y = yPassaggio ?? (p1.y + p2.y) / 2;
  const r = 14;
  return `M ${p1.x} ${p1.y} H ${p1.x + r} V ${y} H ${p2.x - r} V ${p2.y} H ${p2.x}`;
}
