import { arrayRemove, arrayUnion, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useDocument } from "./hooks";

export interface VoceRubrica {
  id: string;
  nome: string;
  iban: string;
}

const ref = () => doc(db(), "config", "rubricaIban");

/** Rubrica IBAN condivisa (documento config/rubricaIban). */
export function useRubrica() {
  const d = useDocument<{ voci?: VoceRubrica[] }>("config", "rubricaIban");
  const voci = [...(d.data?.voci ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  return { voci, loading: d.loading };
}

export const aggiungiVoce = (nome: string, iban: string) =>
  setDoc(ref(), { voci: arrayUnion({ id: Math.random().toString(36).slice(2, 10), nome: nome.trim(), iban: iban.trim() }) }, { merge: true });

export const rimuoviVoce = (v: VoceRubrica) => setDoc(ref(), { voci: arrayRemove(v) }, { merge: true });

/** Se il testo sembra un IBAN (solo lettere/cifre/spazi) lo restituisce compatto; altrimenti com'è. */
export function ibanCompatto(s: string) {
  const t = s.trim();
  return /^[A-Za-z]{2}[0-9A-Za-z ]{10,40}$/.test(t) ? t.replace(/\s+/g, "").toUpperCase() : t;
}

/** IBAN leggibile a gruppi di 4 (IT60 X054 2811 ...), se il testo sembra un IBAN; altrimenti com'è. */
export function ibanLeggibile(s: string) {
  const c = ibanCompatto(s);
  return /^[A-Z]{2}[0-9A-Z]{12,}$/.test(c) ? c.replace(/(.{4})/g, "$1 ").trim() : s.trim();
}

export function copiaTesto(testo: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(testo);
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = testo;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) resolve();
    else reject(new Error("copia non riuscita"));
  });
}
