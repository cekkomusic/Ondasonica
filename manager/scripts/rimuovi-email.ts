/**
 * Toglie dai lead in Firestore gli indirizzi email non più validi
 * (rimbalzati come inesistenti o con casella piena).
 *
 *     npm run rimuovi-email -- elenco.txt            # prova: mostra cosa cambierebbe
 *     npm run rimuovi-email -- elenco.txt --applica  # scrive davvero
 *
 * elenco.txt = un indirizzo per riga (anche separati da ; o ,).
 * Tocca solo i campi "contatto" e "noteRicerca": il lead resta, con telefono, sito e social.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { collection, connectFirestoreEmulator, doc, getDocs, getFirestore, terminate, writeBatch } from "firebase/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const applica = process.argv.includes("--applica");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("✗ Indica il file con gli indirizzi: npm run rimuovi-email -- elenco.txt [--applica]");
  process.exit(1);
}

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

const esclusi = new Set(
  readFileSync(resolve(process.cwd(), file), "utf8")
    .split(/[\s;,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@")),
);
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;

/** Toglie le email escluse da un testo e ripulisce i separatori rimasti vuoti. */
function pulisci(testo: string) {
  let tolte = 0;
  const nuovo = testo
    .replace(RE_EMAIL, (e) => (esclusi.has(e.toLowerCase()) ? (tolte++, "") : e))
    .split(/\s*\|\s*/)
    .map((p) => p.replace(/\s*[;,]\s*(?=[;,]|$)/g, "").replace(/^[;,\s]+/, "").trim())
    .filter(Boolean)
    .join(" | ");
  return { nuovo, tolte };
}

async function main() {
  console.log(`Indirizzi da togliere: ${esclusi.size}`);
  const snap = await getDocs(collection(db, "leads"));
  const modifiche: { id: string; nome: string; campi: Record<string, string>; tolte: number }[] = [];
  for (const d of snap.docs) {
    const l = d.data() as { nome?: string; contatto?: string; noteRicerca?: string };
    const campi: Record<string, string> = {};
    let tolte = 0;
    for (const k of ["contatto", "noteRicerca"] as const) {
      if (typeof l[k] !== "string") continue;
      const r = pulisci(l[k]);
      if (r.tolte) {
        campi[k] = k === "contatto" && !r.nuovo ? "contatti da reperire" : r.nuovo;
        tolte += r.tolte;
      }
    }
    if (tolte) modifiche.push({ id: d.id, nome: l.nome ?? d.id, campi, tolte });
  }

  for (const m of modifiche) console.log(`- ${m.nome}: ${m.tolte} email → contatto "${m.campi.contatto ?? "(invariato)"}"`);
  console.log(`${modifiche.length} lead su ${snap.size} da aggiornare.`);
  if (!applica) {
    console.log("Prova a vuoto: niente è stato scritto. Rilancia con --applica per salvare.");
    return;
  }

  // Firestore accetta max 500 scritture per batch.
  for (let i = 0; i < modifiche.length; i += 400) {
    const batch = writeBatch(db);
    for (const m of modifiche.slice(i, i + 400)) batch.update(doc(db, "leads", m.id), m.campi);
    await batch.commit();
  }
  console.log(`✓ Aggiornati ${modifiche.length} lead.`);
}

main()
  .catch((e) => {
    console.error("✗ Errore:", e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => terminate(db));
