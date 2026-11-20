import { collection, deleteField, doc, documentId, getDoc, getDocs, query, setDoc, where, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "./firebase";

/** Formazione aggiornata: Giulio prende il posto di Adry, Matteo e Fabrizio non ci sono più. */
export const VECCHIO = "ADRY";
export const NUOVO = "GIULIO";
export const USCITI = ["MATTEO", "FABRIZIO"];

/** Lista partecipanti già corretta anche prima che la migrazione dei dati sia finita. */
export const aggiornaNomi = (lista: string[]) =>
  [...new Set(lista.map((p) => (p === VECCHIO ? NUOVO : p)))].filter((p) => !USCITI.includes(p));

/**
 * Sposta una volta sola i dati di Adry su Giulio (quote delle spese, calendario,
 * scaletta personale, concerti presi) e toglie Matteo/Fabrizio dai partecipanti.
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

  // Calendario (un documento per mese: config/calendario-AAAA-MM)
  const mesi = await getDocs(query(collection(db(), "config"), where(documentId(), ">=", "calendario-"), where(documentId(), "<", "calendario.")));
  for (const m of mesi.docs) {
    const campi: Record<string, unknown> = {};
    for (const [giorno, v] of Object.entries(m.data())) {
      const g = v as Record<string, unknown> | null;
      if (g && typeof g === "object" && g[VECCHIO] && !g[NUOVO]) {
        campi[`${giorno}.${NUOVO}`] = g[VECCHIO];
        campi[`${giorno}.${VECCHIO}`] = deleteField();
      }
    }
    if (Object.keys(campi).length) b().update(m.ref, campi);
  }

  // Scaletta personale
  const sv = await getDoc(doc(db(), "scalette", VECCHIO));
  if (sv.exists()) {
    const sn = await getDoc(doc(db(), "scalette", NUOVO));
    if (!sn.exists()) b().set(sn.ref, sv.data());
    b().delete(sv.ref);
  }

  // Concerti "presi da"
  for (const d of (await getDocs(query(collection(db(), "date"), where("presaDa", "==", VECCHIO)))).docs) b().update(d.ref, { presaDa: NUOVO });

  for (const x of batches) await x.commit();
  await setDoc(flag, { adryGiulio: new Date().toISOString() }, { merge: true });
}
