/**
 * Promemoria del mattino. Chiamato dai cron di Vercel (vedi vercel.json) alle 07:00 e alle 08:00 UTC:
 * invia solo quando in Italia sono le 9 (così funziona sia con l'ora legale sia con quella solare)
 * e al massimo una volta al giorno.
 *
 * Parametri (con l'header Authorization: Bearer CRON_SECRET):
 *   ?force=1  invia anche se non sono le 9 o se oggi è già stato inviato
 *   ?dry=1    non invia: restituisce i messaggi che verrebbero mandati
 *   ?giorno=YYYY-MM-DD  per provare un altro giorno
 */
import { admin, datiGiorno, invia, json, oraItalia, righeGiorno, testoPer, titoloGiorno } from "./_lib.js";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ errore: "non autorizzato" }, 401);

  const url = new URL(request.url);
  const force = url.searchParams.has("force");
  const dry = url.searchParams.has("dry");
  const adesso = oraItalia();
  const giornoIso = url.searchParams.get("giorno") || adesso.giorno;

  if (!force && !dry && adesso.ora !== 9) return json({ saltato: `in Italia sono le ${adesso.ora}, si invia alle 9` });

  const { db } = admin();
  const logRef = db.doc("config/notificheLog");
  if (!force && !dry && (await logRef.get()).data()?.ultimoInvio === giornoIso) return json({ saltato: "già inviato oggi" });

  const { giorno, concerti, dispositivi } = await datiGiorno(giornoIso);
  const righe = righeGiorno(giorno, concerti);
  const title = titoloGiorno(giornoIso);
  const messaggi = righe.length
    ? Object.entries(dispositivi).map(([id, d]) => ({ id, token: d.token, title, body: testoPer(d.membro, giorno, righe) }))
    : [];

  if (dry) return json({ giorno: giornoIso, righe, messaggi: messaggi.map(({ token: _t, ...m }) => m) });

  const esito = await invia(messaggi);
  await logRef.set({ ultimoInvio: giornoIso, esito, righe: righe.length, at: new Date().toISOString() }, { merge: true });
  return json({ giorno: giornoIso, righe: righe.length, ...esito, nota: righe.length ? undefined : "nessun evento oggi: nessuna notifica" });
}
