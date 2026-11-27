import { collection, deleteField, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "./firebase";

/** Formazione aggiornata: Giulio prende il posto di Adry, Matteo e Fabrizio non ci sono più. */
export const VECCHIO = "ADRY";
export const NUOVO = "GIULIO";
export const USCITI = ["MATTEO", "FABRIZIO"];

/** Lista partecipanti già corretta anche prima che la migrazione dei dati sia finita. */
export const aggiornaNomi = (lista: string[]) =>
  [...new Set(lista.map((p) => (p === VECCHIO ? NUOVO : p)))].filter((p) => !USCITI.includes(p));

/**
 * Sposta una volta sola su Giulio le quote delle spese e la scaletta personale di Adry
 * e toglie Matteo/Fabrizio dai partecipanti. Calendario e concerti restano a nome di Adry/Fabrizio.
 * Gira al primo accesso di chiunque; poi segna config/migrazioni.adryGiulio.
 */
export async function migraAdryGiulio() {
  const flag = doc(db(), "config", "migrazioni");
  if ((await getDoc(flag)).data()?.adryGiulio) return;

  const batches: WriteBatch[] = [writeBatch(db())];
  let n = 0;
  const b = () => {
    if (++n % 400 === 0) batches.push(writeBatch(db()));
    return batches[batches.length - 1];
  };

  // Partecipanti delle spese
  const cfg = await getDoc(doc(db(), "config", "spese"));
  const part = cfg.data()?.partecipanti as string[] | undefined;
  if (part?.length) b().update(cfg.ref, { partecipanti: aggiornaNomi(part) });

  // Quote delle spese
  for (const s of (await getDocs(collection(db(), "spese"))).docs) {
    const d = s.data();
    const campi: Record<string, unknown> = {};
    if (d.pagamenti?.[VECCHIO] && !d.pagamenti?.[NUOVO]) {
      campi[`pagamenti.${NUOVO}`] = d.pagamenti[VECCHIO];
      campi[`pagamenti.${VECCHIO}`] = deleteField();
    }
    if (d.inseritoDa === VECCHIO) campi.inseritoDa = NUOVO;
    if (Object.keys(campi).length) b().update(s.ref, campi);
  }

  // Calendario e concerti "presi da" NON si toccano: restano a nome di chi li ha segnati
  // (ADRY, FABRIZIO, MATTEO) e l'app li mostra come "ex".

  // Scaletta personale
  const sv = await getDoc(doc(db(), "scalette", VECCHIO));
  if (sv.exists()) {
    const sn = await getDoc(doc(db(), "scalette", NUOVO));
    if (!sn.exists()) b().set(sn.ref, sv.data());
    b().delete(sv.ref);
  }

  for (const x of batches) await x.commit();
  await setDoc(flag, { adryGiulio: new Date().toISOString() }, { merge: true });
}

/**
 * Ripristino della scheda tecnica (azzerata per errore a novembre 2026) dal PDF del 7/10/2026,
 * con Giulio al posto di Adry, senza il fonico e con il basso diretto nel Behringer X18.
 * Riempie solo i campi vuoti: non tocca nulla che la band abbia già riscritto. Gira una volta sola.
 */
export async function ripristinaScheda() {
  const flag = doc(db(), "config", "migrazioni");
  if ((await getDoc(flag)).data()?.schedaRipristino2026) return;
  const backup = (await import("../../data/scheda_ripristino_2026.json")).default as Record<string, unknown>;
  const ref = doc(db(), "config", "schedaTecnica");
  const attuale = ((await getDoc(ref)).data() ?? {}) as Record<string, unknown>;
  const vuoto = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
  const campi: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(backup)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sezione = (attuale[k] ?? {}) as Record<string, unknown>;
      for (const [c, val] of Object.entries(v as Record<string, unknown>)) if (vuoto(sezione[c]) && !vuoto(val)) campi[`${k}.${c}`] = val;
    } else if (vuoto(attuale[k]) && !vuoto(v)) campi[k] = v;
  }
  if (Object.keys(campi).length) {
    campi.aggiornato = new Date().toISOString();
    if (Object.keys(attuale).length) await updateDoc(ref, campi);
    else await setDoc(ref, { ...backup, aggiornato: campi.aggiornato });
  }
  await setDoc(flag, { schedaRipristino2026: new Date().toISOString() }, { merge: true });
}
