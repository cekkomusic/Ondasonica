import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useDocument } from "../lib/hooks";
import { copiaTesto } from "../lib/iban";
import { SyncedField } from "./SyncedField";
import { useSave } from "./Toast";

interface Note {
  testo?: string;
  aggiornato?: string;
  da?: string;
}

const ESEMPIO = `Es.
• Vinile Torino – parlato con Marco (338…) il 10/10: interessati per gennaio, cachet proposto 600 €, aspettano conferma data
• Pro Loco Cossano Belbo – mandata mail 12/10, richiamare a fine mese
• Festa di Boves – chiedono service incluso, valutare costi`;

/** Blocco note condiviso delle trattative in corso (config/trattative), modificabile da tutta la band. */
export function Trattative({ onClose }: { onClose: () => void }) {
  const save = useSave();
  const { data } = useDocument<Note>("config", "trattative");
  const testo = data?.testo ?? "";
  const salva = (v: string) => {
    let da = "";
    try {
      da = localStorage.getItem("ondasonica.me") ?? "";
    } catch {
      /* storage non disponibile */
    }
    save(setDoc(doc(db(), "config", "trattative"), { testo: v, aggiornato: new Date().toISOString(), da }, { merge: true }), "Trattative salvate");
  };
  const quando = data?.aggiornato
    ? new Date(data.aggiornato).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <section className="card trattative">
      <div className="email-head">
        <strong>📝 Trattative in corso</strong>
        <div className="trattative-azioni">
          <button className="btn sm" disabled={!testo} onClick={() => save(copiaTesto(testo), "Testo copiato")}>
            📋 Copia
          </button>
          <button className="btn sm" onClick={onClose} aria-label="Chiudi trattative">
            ✕
          </button>
        </div>
      </div>
      <SyncedField multiline rows={14} className="trattative-text" value={testo} onSave={salva} placeholder={ESEMPIO} />
      <p className="small muted">
        Si salva da solo mentre scrivi ed è condiviso con tutta la band.
        {quando && ` Ultima modifica: ${quando}${data?.da ? ` · ${data.da}` : ""}.`}
      </p>
    </section>
  );
}
