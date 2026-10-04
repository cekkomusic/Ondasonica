import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Import iniziale dei dati di data/*.json direttamente dall'app (stessa logica di scripts/seed.ts).
 * Non sovrascrive nulla se il database risulta già popolato.
 */
export async function importaDatiIniziali() {
  const marker = doc(db(), "config", "seed");
  if ((await getDoc(marker)).exists()) throw new Error("Il database è già stato popolato.");

  const [leads, attivita, spese, scheda, scaletta] = await Promise.all([
    import("../../data/leads.json").then((m) => m.default as { id: string }[]),
    import("../../data/attivita.json").then((m) => m.default as { id: string }[]),
    import("../../data/spese.json").then((m) => m.default),
    import("../../data/scheda_tecnica.json").then((m) => m.default),
    import("../../data/scaletta.json").then((m) => m.default),
  ]);

  const b = writeBatch(db());
  for (const l of leads) b.set(doc(db(), "leads", l.id), l);
  attivita.forEach((a, i) => b.set(doc(db(), "attivita", a.id), { ...a, createdAt: i }));
  b.set(doc(db(), "config", "spese"), { partecipanti: spese.partecipanti, divisioneDefault: spese.divisioneDefault });
  b.set(doc(db(), "config", "schedaTecnica"), scheda);
  const live = doc(db(), "scalette", "live");
  if (!(await getDoc(live)).exists()) {
    const righe = scaletta.righe.map((r, i) => ({ id: `r${i}`, tipo: r.tipo, titolo: r.titolo, colore: "" }));
    b.set(live, { righe, aggiornato: new Date().toISOString(), origine: "" });
  }
  b.set(marker, { at: new Date().toISOString(), da: "app" });
  await b.commit();
}
