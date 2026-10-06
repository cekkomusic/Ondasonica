/**
 * Notifica di prova per un dispositivo (tasto "Invia notifica di prova" nell'app).
 * Manda solo al dispositivo indicato, al massimo una volta al minuto.
 */
import { admin, datiGiorno, invia, json, oraItalia, righeGiorno, testoPer } from "./_lib.js";

export async function POST(request: Request) {
  let id = "";
  try {
    id = String(((await request.json()) as { id?: string }).id ?? "");
  } catch {
    /* corpo non valido */
  }
  if (!/^[a-z0-9]{4,40}$/.test(id)) return json({ errore: "id non valido" }, 400);

  const { db } = admin();
  const oggi = oraItalia().giorno;
  const { giorno, concerti, dispositivi } = await datiGiorno(oggi);
  const d = dispositivi[id];
  if (!d) return json({ errore: "dispositivo non registrato" }, 404);
  if (d.ultimoTest && Date.now() - Date.parse(d.ultimoTest) < 60_000) return json({ errore: "aspetta un minuto prima di riprovare" }, 429);
  await db.doc("config/notifiche").set({ dispositivi: { [id]: { ultimoTest: new Date().toISOString() } } }, { merge: true });

  const righe = righeGiorno(giorno, concerti);
  const body = righe.length
    ? `Ecco l'anteprima di oggi:\n${testoPer(d.membro, giorno, righe)}`
    : "Funzionano! Ogni mattina verso le 9 riceverai il promemoria di ciò che è segnato in calendario.";
  const esito = await invia([{ id, token: d.token, title: "🔔 Notifiche OndaSonicA attive", body }]);
  return esito.inviati ? json({ ok: true }) : json({ errore: "invio non riuscito", ...esito }, 502);
}
