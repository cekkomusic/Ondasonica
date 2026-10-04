import { arrayRemove, arrayUnion, deleteField, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/** Impegno di un membro per un giorno. */
export interface Impegno {
  nota: string;
  indisponibile: boolean;
  aggiornato?: string;
}

/** Un documento per mese: config/calendario-YYYY-MM → { "YYYY-MM-DD": { MEMBRO: Impegno } } */
export type MeseCalendario = Record<string, Record<string, Impegno>>;

export const meseId = (isoDay: string) => `calendario-${isoDay.slice(0, 7)}`;

export function salvaImpegno(giorno: string, membro: string, imp: Impegno) {
  const ref = doc(db(), "config", meseId(giorno));
  const vuoto = !imp.nota.trim() && !imp.indisponibile;
  return setDoc(
    ref,
    { [giorno]: { [membro]: vuoto ? deleteField() : { nota: imp.nota.trim(), indisponibile: imp.indisponibile, aggiornato: new Date().toISOString() } } },
    { merge: true },
  );
}

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------- Eventi della band (prove, passaggi nei locali) ---------- */

export const BAND = "BAND";

export const TIPI_EVENTO = {
  prove: { icona: "🥁", label: "Prove" },
  passaggio: { icona: "🤝", label: "Passaggio locale" },
} as const;
export type TipoEvento = keyof typeof TIPI_EVENTO;

export interface EventoBand {
  id: string;
  tipo: TipoEvento;
  nota: string;
  creato: string;
}

/** Eventi band di un giorno (salvati in giorno.BAND.eventi). */
export const eventiBand = (giorno: Record<string, unknown> | undefined): EventoBand[] =>
  ((giorno?.[BAND] as { eventi?: EventoBand[] } | undefined)?.eventi ?? []).filter((e) => e && e.tipo in TIPI_EVENTO);

export function aggiungiEventoBand(giorno: string, tipo: TipoEvento, nota: string) {
  const ev: EventoBand = { id: Math.random().toString(36).slice(2, 10), tipo, nota: nota.trim(), creato: new Date().toISOString() };
  return setDoc(doc(db(), "config", meseId(giorno)), { [giorno]: { [BAND]: { eventi: arrayUnion(ev) } } }, { merge: true });
}

export function rimuoviEventoBand(giorno: string, ev: EventoBand) {
  return setDoc(doc(db(), "config", meseId(giorno)), { [giorno]: { [BAND]: { eventi: arrayRemove(ev) } } }, { merge: true });
}
