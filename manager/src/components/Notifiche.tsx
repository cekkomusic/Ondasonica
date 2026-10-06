import { useEffect, useState } from "react";
import { attivaNotifiche, disattivaNotifiche, inviaProva, notificheConfigurate, statoNotifiche, type StatoNotifiche } from "../lib/notifiche";
import { useSave } from "./Toast";

/** Riquadro per attivare i promemoria delle 9:00 su questo telefono. */
export function NotificheCard({ membro }: { membro: string }) {
  const save = useSave();
  const [stato, setStato] = useState<StatoNotifiche | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    statoNotifiche().then(setStato, () => setStato("non-supportate"));
  }, []);

  if (!notificheConfigurate || stato === null) return null;

  const run = (p: Promise<unknown>, msg: string) => {
    setBusy(true);
    save(p, msg);
    p.finally(() => statoNotifiche().then(setStato).finally(() => setBusy(false)));
  };

  return (
    <section className={`card notif-card ${stato === "attive" ? "on" : ""}`}>
      <div className="row">
        <span className="notif-ico">🔔</span>
        <div className="grow">
          <strong>Promemoria alle 9:00</strong>
          <p className="muted small">
            {stato === "attive"
              ? "Attivi su questo telefono: ogni mattina ricevi gli eventi del giorno."
              : "Ogni mattina una notifica con ciò che è segnato in calendario per quel giorno."}
          </p>
        </div>
      </div>

      {stato === "ios-installa" && (
        <p className="hint-box small">
          Su iPhone le notifiche funzionano solo dall'app installata: tocca <strong>Condividi → Aggiungi alla schermata Home</strong>, apri
          OndaSonicA dall'icona e torna qui.
        </p>
      )}
      {stato === "non-supportate" && <p className="hint-box small">Questo browser non supporta le notifiche. Prova con Chrome.</p>}
      {stato === "negate" && (
        <p className="hint-box small">
          Le notifiche sono bloccate per questo sito. Riattivale dalle impostazioni del browser (icona del lucchetto accanto all'indirizzo →
          Notifiche → Consenti), poi ricarica la pagina.
        </p>
      )}

      {stato === "disattive" && (
        <button className="btn primary block" disabled={busy} onClick={() => run(attivaNotifiche(membro), "Notifiche attivate 🔔")}>
          Attiva notifiche
        </button>
      )}
      {stato === "attive" && (
        <div className="row two">
          <button className="btn ghost" disabled={busy} onClick={() => run(inviaProva(), "Notifica di prova inviata")}>
            Invia prova
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => run(disattivaNotifiche(), "Notifiche disattivate")}>
            Disattiva
          </button>
        </div>
      )}
    </section>
  );
}
