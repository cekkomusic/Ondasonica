/**
 * Import iniziale dei dati di data/*.json in Firestore.
 *
 * Da eseguire UNA SOLA VOLTA dopo aver creato il progetto Firebase:
 *     npm run seed
 *
 * Se il database è già stato popolato lo script si ferma, per non
 * sovrascrivere le modifiche fatte dalla band. Per forzare la reimportazione
 * (CANCELLA stati, note e date inseriti nell'app per lead/attività/scheda):
 *     npm run seed:force
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, terminate, writeBatch } from "firebase/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");

// Legge .env / .env.local (stesse variabili usate da Vite).
for (const f of [".env", ".env.local"]) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const env = (k: string) => {
  const v = process.env[k];
  if (!v) {
    console.error(`✗ Variabile ${k} mancante: compila il file .env (vedi .env.example).`);
    process.exit(1);
  }
  return v;
};

const app = initializeApp({
  apiKey: env("VITE_FIREBASE_API_KEY"),
  authDomain: env("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: env("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env("VITE_FIREBASE_APP_ID"),
});
const db = getFirestore(app);
if (process.env.VITE_FIRESTORE_EMULATOR) {
  const [host, port] = process.env.VITE_FIRESTORE_EMULATOR.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  console.log(`(uso l'emulatore Firestore su ${process.env.VITE_FIRESTORE_EMULATOR})`);
}

const load = <T>(name: string): T => JSON.parse(readFileSync(resolve(root, "data", name), "utf8"));

async function main() {
  const marker = doc(db, "config", "seed");
  const existing = await getDoc(marker);

  // La scaletta è stata aggiunta dopo: la carichiamo se manca, anche su un database già popolato.
  const live = doc(db, "scalette", "live");
  if (force || !(await getDoc(live)).exists()) {
    const sc = load<{ righe: { tipo: string; titolo: string }[] }>("scaletta.json");
    const righe = sc.righe.map((r, i) => ({ id: `r${i}`, tipo: r.tipo, titolo: r.titolo, colore: "" }));
    const b = writeBatch(db);
    b.set(live, { righe, aggiornato: new Date().toISOString(), origine: "" }, { merge: true });
    await b.commit();
    console.log(`✓ Scaletta prossimo live importata (${righe.length} righe).`);
  }

  if (existing.exists() && !force) {
    console.log(`ℹ Database già popolato il ${existing.data().at}. Niente da fare.`);
    console.log("  Per reimportare tutto (sovrascrive le modifiche fatte nell'app): npm run seed:force");
    return;
  }

  const leads = load<{ id: string }[]>("leads.json");
  const attivita = load<{ id: string }[]>("attivita.json");
  const spese = load<{ partecipanti: string[]; divisioneDefault: string; spese: { id?: string }[] }>("spese.json");
  const scheda = load<Record<string, unknown>>("scheda_tecnica.json");

  // Firestore accetta max 500 scritture per batch: qui sono < 100.
  const batch = writeBatch(db);
  for (const l of leads) batch.set(doc(db, "leads", l.id), l);
  attivita.forEach((a, i) => batch.set(doc(db, "attivita", a.id), { ...a, createdAt: i }));
  batch.set(doc(db, "config", "spese"), { partecipanti: spese.partecipanti, divisioneDefault: spese.divisioneDefault });
  spese.spese.forEach((s, i) => batch.set(doc(db, "spese", s.id ?? `seed-${i}`), s));
  batch.set(doc(db, "config", "schedaTecnica"), scheda);
  batch.set(marker, { at: new Date().toISOString() });
  await batch.commit();

  console.log(`✓ Importati ${leads.length} lead, ${attivita.length} attività, ${spese.spese.length} spese, scheda tecnica e config.`);
}

main()
  .catch((e) => {
    console.error("✗ Errore durante il seed:", e.message ?? e);
    if (String(e.code).includes("permission")) console.error("  Hai pubblicato le regole di firestore.rules nella console Firebase?");
    process.exitCode = 1;
  })
  .finally(() => terminate(db));
