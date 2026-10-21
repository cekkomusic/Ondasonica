/**
 * Importa in Firestore i contatti a cui abbiamo già scritto (e chi ci ha risposto),
 * con stato, data dell'ultimo contatto e nota. Facoltativo: aggiunge un testo in
 * cima alle "Trattative in corso".
 *
 *     npm run importa-contatti -- contatti.json [--trattative testo.txt]            # prova
 *     npm run importa-contatti -- contatti.json [--trattative testo.txt] --applica  # scrive
 *
 * contatti.json = lista di oggetti come quelli di "Importa lista" (nome, tipo, comune,
 * provincia, regione, email, telefono, …) più statoContatto, dataUltimoContatto, notaUtente.
 * I lead già presenti (stessa email, o stesso nome nello stesso comune) non vengono
 * duplicati: si aggiorna lo stato solo se va avanti, la data se è più recente, e si
 * aggiunge la nota.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, terminate, writeBatch } from "firebase/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const applica = args.includes("--applica");
const iTratt = args.indexOf("--trattative");
const fileTratt = iTratt >= 0 ? args[iTratt + 1] : undefined;
const file = args.find((a, i) => !a.startsWith("--") && a !== fileTratt && i !== iTratt + 1);
if (!file) {
  console.error("✗ Indica il file: npm run importa-contatti -- contatti.json [--trattative testo.txt] [--applica]");
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

interface Contatto {
  nome: string;
  tipo?: string;
  comune?: string;
  provincia?: string;
  regione?: string;
  periodo?: string;
  genere?: string;
  tipologiaArtisti?: string;
  email: string;
  telefono?: string;
  sito?: string;
  social?: string;
  referente?: string;
  noteRicerca?: string;
  fonte?: string;
  priorita?: string;
  statoContatto: string;
  dataUltimoContatto: string | null;
  notaUtente?: string;
}
interface LeadDoc {
  nome?: string;
  comune?: string;
  contatto?: string;
  statoContatto?: string;
  dataUltimoContatto?: string | null;
  notaUtente?: string;
  ordine?: number;
}

// Stessi valori di src/lib/types.ts; l'ordine dice quanto è avanti un lead.
const STATI = ["Da contattare", "Contattato", "Risposta ricevuta", "Non interessato", "Data fissata"];
const PRIORITA = ["Alta", "Media-Alta", "Media", "Info/Concorrenza"];
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chiaveNome = (s: string) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();
const chiaveLuogo = (nome: string, comune: string) => `${chiaveNome(nome)}|${chiaveNome(comune.replace(/\(.*\)/, ""))}`;
const emailDi = (s: string) => (s.match(RE_EMAIL) ?? []).map((e) => e.toLowerCase());

async function main() {
  const contatti = JSON.parse(readFileSync(resolve(process.cwd(), file!), "utf8")) as Contatto[];
  const snap = await getDocs(collection(db, "leads"));
  const perEmail = new Map<string, string>();
  const perLuogo = new Map<string, string>();
  const esistenti = new Map<string, LeadDoc>();
  for (const d of snap.docs) {
    const l = d.data() as LeadDoc;
    esistenti.set(d.id, l);
    for (const e of emailDi(l.contatto ?? "")) perEmail.set(e, d.id);
    perLuogo.set(chiaveLuogo(l.nome ?? "", l.comune ?? ""), d.id);
  }
  let ordine = [...esistenti.values()].reduce((m, l) => Math.max(m, l.ordine ?? 0), 0);

  const nuovi: Record<string, unknown>[] = [];
  const aggiornati: { id: string; campi: Record<string, unknown> }[] = [];
  for (const [k, c] of contatti.entries()) {
    const comune = c.provincia ? `${c.comune ?? ""} (${c.provincia})` : c.comune ?? "";
    const id = emailDi(c.email).map((e) => perEmail.get(e)).find(Boolean) ?? perLuogo.get(chiaveLuogo(c.nome, comune));
    if (id) {
      const l = esistenti.get(id)!;
      const campi: Record<string, unknown> = {};
      if (STATI.indexOf(c.statoContatto) > STATI.indexOf(l.statoContatto ?? "Da contattare")) campi.statoContatto = c.statoContatto;
      if (c.dataUltimoContatto && c.dataUltimoContatto > (l.dataUltimoContatto ?? "")) campi.dataUltimoContatto = c.dataUltimoContatto;
      if (c.notaUtente && !(l.notaUtente ?? "").includes(c.notaUtente))
        campi.notaUtente = [l.notaUtente, c.notaUtente].filter(Boolean).join("\n");
      if (Object.keys(campi).length) aggiornati.push({ id, campi });
      continue;
    }
    const nuovoId = `${chiaveNome(c.nome).replace(/ /g, "-").slice(0, 50)}-${Date.now().toString(36)}${k}`;
    const contatto = [c.referente && `Ref. ${c.referente}`, c.email, c.telefono, c.social, c.sito].filter(Boolean).join(" | ");
    nuovi.push({
      id: nuovoId,
      ordine: ++ordine,
      priorita: PRIORITA.includes(c.priorita ?? "") ? c.priorita : "Media",
      nome: c.nome.trim(),
      tipo: c.tipo ?? "",
      comune,
      regione: c.regione ?? "",
      periodo2026: c.periodo ?? "",
      genere: [c.genere, c.tipologiaArtisti].filter(Boolean).join(" · "),
      contatto: contatto || "contatti da reperire",
      noteRicerca: c.noteRicerca ?? "",
      fonte: c.fonte ?? "",
      statoContatto: STATI.includes(c.statoContatto) ? c.statoContatto : "Contattato",
      notaUtente: c.notaUtente ?? "",
      dataUltimoContatto: c.dataUltimoContatto ?? null,
      origine: "email inviate",
    });
    for (const e of emailDi(c.email)) perEmail.set(e, nuovoId);
    perLuogo.set(chiaveLuogo(c.nome, comune), nuovoId);
  }

  const conta = (xs: Record<string, unknown>[]) =>
    xs.reduce<Record<string, number>>((m, x) => ((m[String(x.statoContatto)] = (m[String(x.statoContatto)] ?? 0) + 1), m), {});
  console.log(`Contatti nel file: ${contatti.length} · lead già in app: ${snap.size}`);
  console.log(`Nuovi lead: ${nuovi.length}`, conta(nuovi));
  console.log(`Lead esistenti da aggiornare: ${aggiornati.length}`);
  for (const a of aggiornati) console.log(`- ${esistenti.get(a.id)?.nome}: ${Object.keys(a.campi).join(", ")}`);

  let testoTratt = "";
  if (fileTratt) {
    const prima = ((await getDoc(doc(db, "config", "trattative"))).data()?.testo as string | undefined) ?? "";
    const aggiunta = readFileSync(resolve(process.cwd(), fileTratt), "utf8").trim();
    testoTratt = prima.includes(aggiunta) ? "" : [aggiunta, prima.trim()].filter(Boolean).join("\n\n");
    console.log(testoTratt ? "Trattative: il testo verrà aggiunto in cima." : "Trattative: testo già presente, niente da fare.");
  }

  if (!applica) {
    console.log("Prova a vuoto: niente è stato scritto. Rilancia con --applica per salvare.");
    return;
  }

  // Firestore accetta max 500 scritture per batch.
  const scritture = [
    ...nuovi.map((n) => (b: ReturnType<typeof writeBatch>) => b.set(doc(db, "leads", String(n.id)), n)),
    ...aggiornati.map((a) => (b: ReturnType<typeof writeBatch>) => b.update(doc(db, "leads", a.id), a.campi)),
  ];
  for (let i = 0; i < scritture.length; i += 400) {
    const batch = writeBatch(db);
    for (const w of scritture.slice(i, i + 400)) w(batch);
    await batch.commit();
  }
  if (testoTratt) {
    const batch = writeBatch(db);
    batch.set(doc(db, "config", "trattative"), { testo: testoTratt, aggiornato: new Date().toISOString(), da: "Import Gmail" }, { merge: true });
    await batch.commit();
  }
  console.log(`✓ Creati ${nuovi.length} lead, aggiornati ${aggiornati.length}${testoTratt ? ", trattative aggiornate" : ""}.`);
}

main()
  .catch((e) => {
    console.error("✗ Errore:", e.message ?? e);
    if (String(e.code).includes("permission")) console.error("  Hai pubblicato le regole di firestore.rules nella console Firebase?");
    process.exitCode = 1;
  })
  .finally(() => terminate(db));
