/** Creazione di nuovi lead (da link, a mano o da una lista importata). */
import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Lead, Priorita } from "./types";
import { norm } from "./format";

export interface Candidato {
  nome: string;
  tipo: string;
  comune: string;
  provincia: string;
  regione: string;
  periodo: string;
  genere: string;
  tipologiaArtisti: string;
  email: string;
  telefono: string;
  sito: string;
  social: string;
  referente: string;
  noteRicerca: string;
  fonte: string;
  priorita: Priorita;
}

export const PRIORITA_OK: Priorita[] = ["Alta", "Media-Alta", "Media", "Info/Concorrenza"];

export const chiaveNome = (s: string) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();

export const vuoto = (): Candidato => ({
  nome: "", tipo: "", comune: "", provincia: "", regione: "", periodo: "", genere: "", tipologiaArtisti: "",
  email: "", telefono: "", sito: "", social: "", referente: "", noteRicerca: "", fonte: "", priorita: "Media",
});

/** Normalizza un oggetto arrivato da una lista incollata (campi mancanti = vuoti). */
export function daOggetto(o: Record<string, unknown>): Candidato | null {
  const c = vuoto();
  for (const k of Object.keys(c) as (keyof Candidato)[]) {
    const v = o[k];
    if (typeof v === "string") (c[k] as string) = v.trim();
    else if (Array.isArray(v)) (c[k] as string) = v.filter((x) => typeof x === "string").join(", ");
  }
  if (!PRIORITA_OK.includes(c.priorita)) c.priorita = "Media";
  return c.nome ? c : null;
}

/** Accetta JSON (anche dentro ```json … ```), un oggetto singolo o { risultati: [...] }. */
export function parseLista(testo: string): Candidato[] {
  const pulito = testo.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const inizio = pulito.search(/[[{]/);
  if (inizio < 0) throw new Error("Nessun elenco riconosciuto: incolla il testo che ti ho preparato in chat.");
  const dati = JSON.parse(pulito.slice(inizio)) as unknown;
  const arr = Array.isArray(dati) ? dati : (dati as { risultati?: unknown[] }).risultati ?? [dati];
  return arr.map((o) => (o && typeof o === "object" ? daOggetto(o as Record<string, unknown>) : null)).filter((c): c is Candidato => !!c);
}

const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const chiaveLuogo = (nome: string, comune: string) => `${chiaveNome(nome)}|${chiaveNome(comune.replace(/\(.*\)/, ""))}`;

/** Riconosce i candidati già presenti tra i lead: stesso nome nello stesso comune, oppure stessa email. */
export function giaPresenti(esistenti: Lead[]) {
  const luoghi = new Set(esistenti.map((l) => chiaveLuogo(l.nome, l.comune ?? "")));
  const email = new Set(esistenti.flatMap((l) => (l.contatto ?? "").match(RE_EMAIL) ?? []).map((e) => e.toLowerCase()));
  return (c: Candidato) =>
    luoghi.has(chiaveLuogo(c.nome, c.comune)) || (c.email.match(RE_EMAIL) ?? []).some((e) => email.has(e.toLowerCase()));
}

/** Firestore accetta al massimo 500 scritture per batch: le liste lunghe vanno a blocchi. */
const BLOCCO = 400;

export async function aggiungiLead(candidati: Candidato[], esistenti: Lead[]) {
  const gia = giaPresenti(esistenti);
  const ordineMax = esistenti.reduce((m, l) => Math.max(m, l.ordine ?? 0), 0);
  const visti = new Set<string>();
  const nuovi = candidati.filter((c) => {
    const k = chiaveLuogo(c.nome, c.comune);
    if (!c.nome.trim() || gia(c) || visti.has(k)) return false;
    visti.add(k);
    return true;
  });
  const batches = [writeBatch(db())];
  nuovi.forEach((c, k) => {
    if (k > 0 && k % BLOCCO === 0) batches.push(writeBatch(db()));
    const batch = batches[batches.length - 1];
    const id = `${chiaveNome(c.nome).replace(/ /g, "-").slice(0, 50)}-${Date.now().toString(36)}${k}`;
    const contatto = [c.referente && `Ref. ${c.referente}`, c.email, c.telefono, c.social, c.sito].filter(Boolean).join(" | ");
    const lead: Lead & { origine: string } = {
      id,
      ordine: ordineMax + k + 1,
      priorita: c.priorita,
      nome: c.nome.trim(),
      tipo: c.tipo,
      comune: c.provincia ? `${c.comune} (${c.provincia})` : c.comune,
      regione: c.regione,
      periodo2026: c.periodo,
      genere: [c.genere, c.tipologiaArtisti].filter(Boolean).join(" · "),
      contatto: contatto || "contatti da reperire",
      noteRicerca: c.noteRicerca,
      fonte: c.fonte,
      statoContatto: "Da contattare",
      notaUtente: "",
      dataUltimoContatto: null,
      origine: "trova locali",
    };
    batch.set(doc(db(), "leads", id), lead);
  });
  for (const b of batches) await b.commit();
  return nuovi.length;
}
