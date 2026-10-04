import { deleteField, doc, setDoc } from "firebase/firestore";
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
