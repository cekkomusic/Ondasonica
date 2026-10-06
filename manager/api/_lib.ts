/**
 * Codice condiviso dalle funzioni serverless (Vercel). I file che iniziano con "_"
 * non diventano endpoint.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export { FieldValue };

export function admin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID || "demo-ondasonica" });
    else if (!raw) throw new Error("Variabile FIREBASE_SERVICE_ACCOUNT mancante");
    else initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return { db: getFirestore(), messaging: getMessaging() };
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

/* ---------- Data e ora in Italia ---------- */

export function oraItalia(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { giorno: `${parts.year}-${parts.month}-${parts.day}`, ora: Number(parts.hour) };
}

/* ---------- Contenuto del promemoria ---------- */

const TIPI: Record<string, { icona: string; label: string }> = {
  prove: { icona: "🥁", label: "Prove" },
  passaggio: { icona: "🤝", label: "Passaggio locale" },
};

interface Impegno {
  nota?: string;
  indisponibile?: boolean;
}
interface Concerto {
  locale?: string;
  indirizzo?: string;
}
export type GiornoCal = Record<string, Impegno & { eventi?: { tipo: string; nota?: string }[] }>;

/** Righe comuni a tutti per il giorno: concerti, eventi band, indisponibili, impegni. */
export function righeGiorno(giorno: GiornoCal, concerti: Concerto[]) {
  const righe: string[] = [];
  for (const c of concerti) righe.push(`🎸 Concerto: ${c.locale ?? ""}${c.indirizzo ? ` (${c.indirizzo})` : ""}`);
  for (const e of giorno.BAND?.eventi ?? []) {
    const t = TIPI[e.tipo];
    if (t) righe.push(`${t.icona} ${t.label}${e.nota ? `: ${e.nota}` : ""}`);
  }
  const persone = Object.entries(giorno).filter(([k]) => k !== "BAND");
  const indisp = persone.filter(([, i]) => i.indisponibile).map(([k]) => k);
  if (indisp.length) righe.push(`🔴 Indisponibili: ${indisp.join(", ")}`);
  for (const [k, i] of persone) if (!i.indisponibile && i.nota) righe.push(`📝 ${k}: ${i.nota}`);
  return righe;
}

/** Testo per un dispositivo: in cima l'impegno personale, se c'è. */
export function testoPer(membro: string | undefined, giorno: GiornoCal, righe: string[]) {
  const mio = membro ? giorno[membro] : undefined;
  const top = mio && (mio.nota || mio.indisponibile) ? [`👉 Tu: ${mio.indisponibile ? "indisponibile" : ""}${mio.indisponibile && mio.nota ? " – " : ""}${mio.nota ?? ""}`] : [];
  const comuni = membro ? righe.filter((r) => !r.startsWith(`📝 ${membro}:`)) : righe;
  return [...top, ...comuni].join("\n");
}

export function titoloGiorno(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return `OndaSonicA · ${d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" })}`;
}

export interface Dispositivo {
  token: string;
  membro?: string;
  aggiornato?: string;
  ultimoTest?: string;
}

/** Legge calendario, concerti e dispositivi per il giorno indicato. */
export async function datiGiorno(iso: string) {
  const { db } = admin();
  const [cal, concertiSnap, disp] = await Promise.all([
    db.doc(`config/calendario-${iso.slice(0, 7)}`).get(),
    db.collection("date").where("data", "==", iso).get(),
    db.doc("config/notifiche").get(),
  ]);
  const giorno = ((cal.data() ?? {})[iso] ?? {}) as GiornoCal;
  const concerti = concertiSnap.docs.map((d) => d.data() as Concerto);
  const dispositivi = ((disp.data() ?? {}).dispositivi ?? {}) as Record<string, Dispositivo>;
  return { giorno, concerti, dispositivi };
}

/** Invia a una lista di dispositivi; rimuove quelli non più validi. Restituisce i conteggi. */
export async function invia(lista: { id: string; token: string; title: string; body: string }[]) {
  const { db, messaging } = admin();
  if (!lista.length) return { inviati: 0, falliti: 0, rimossi: 0 };
  const res = await messaging.sendEach(
    lista.map((m) => ({
      token: m.token,
      webpush: {
        headers: { Urgency: "high", TTL: String(6 * 3600) },
        data: { title: m.title, body: m.body, url: "/calendario" },
      },
    })),
  );
  const daRimuovere: string[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code ?? "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) daRimuovere.push(lista[i].id);
  });
  if (daRimuovere.length)
    await db.doc("config/notifiche").set({ dispositivi: Object.fromEntries(daRimuovere.map((id) => [id, FieldValue.delete()])) }, { merge: true });
  return { inviati: res.successCount, falliti: res.failureCount, rimossi: daRimuovere.length };
}
