import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useDocument } from "./hooks";

/** Testo e link YouTube di un brano, condivisi da tutte le scalette (documento config/brani). */
export interface InfoBrano {
  titolo: string;
  testo?: string;
  youtube?: string;
  aggiornato?: string;
}

/** Chiave stabile dal titolo: "Centro di gravità P." → "centro-di-gravita-p". */
export const chiaveBrano = (titolo: string) =>
  titolo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "senza-titolo";

export function useBrani() {
  const d = useDocument<Record<string, InfoBrano>>("config", "brani");
  return d.data ?? {};
}

const salva = (titolo: string, campi: Partial<InfoBrano>) =>
  setDoc(doc(db(), "config", "brani"), { [chiaveBrano(titolo)]: { titolo, ...campi, aggiornato: new Date().toISOString() } }, { merge: true });

export const salvaTesto = (titolo: string, testo: string) => salva(titolo, { testo: testo.replace(/\s+$/, "") });
export const salvaYoutube = (titolo: string, youtube: string) => salva(titolo, { youtube: youtube.trim() });

/** Accetta link http(s); aggiunge https:// se manca. Restituisce "" se non valido. */
export function normalizzaLink(s: string) {
  const t = s.trim();
  if (!t) return "";
  const conProtocollo = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(conProtocollo);
    return u.hostname.includes(".") ? u.toString() : "";
  } catch {
    return "";
  }
}

export const isYoutube = (u: string) => /(^|\.)(youtube\.com|youtu\.be|music\.youtube\.com)$/i.test(new URL(u).hostname);
