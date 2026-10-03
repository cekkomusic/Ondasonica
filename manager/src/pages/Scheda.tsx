import { useEffect, useState } from "react";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useDocument } from "../lib/hooks";
import type { MembroFormazione, SchedaTecnica } from "../lib/types";
import { SyncedField } from "../components/SyncedField";
import { useSave } from "../components/Toast";
import { ErrorBox, Loading } from "../components/States";
import schedaSeed from "../../data/scheda_tecnica.json";

type Sezione = Exclude<keyof SchedaTecnica, "bandNome" | "aggiornato" | "formazione" | "noteGenerali">;

// Etichette leggibili per i campi esistenti (la struttura dati resta quella di data/scheda_tecnica.json).
const SEZIONI: { key: Sezione; titolo: string; icona: string; campi: Record<string, { label: string; hint?: string; multi?: boolean }> }[] = [
  {
    key: "stagePlot",
    titolo: "Stage plot",
    icona: "🗺️",
    campi: {
      descrizione: { label: "Disposizione sul palco", hint: "Chi sta dove, pedane, ingombri…", multi: true },
      immagineUrl: { label: "Link immagine stage plot", hint: "https://… (Drive, Dropbox, ecc.)" },
    },
  },
  {
    key: "backline",
    titolo: "Backline",
    icona: "🥁",
    campi: {
      batteria: { label: "Batteria", multi: true },
      basso: { label: "Basso", multi: true },
      chitarre: { label: "Chitarre", multi: true },
      tastiere: { label: "Tastiere / synth", multi: true },
      altro: { label: "Altro", multi: true },
    },
  },
  {
    key: "audio",
    titolo: "Audio",
    icona: "🎚️",
    campi: {
      canaliRichiesti: { label: "Canali richiesti", hint: "Es. 24 canali + input list" },
      microfoniRichiesti: { label: "Microfoni richiesti", multi: true },
      monitoraggio: { label: "Monitoraggio", hint: "In-ear / spie, quante linee…", multi: true },
      note: { label: "Note audio", multi: true },
    },
  },
  {
    key: "luci",
    titolo: "Luci",
    icona: "💡",
    campi: {
      richiesteSpeciali: { label: "Richieste speciali", multi: true },
      note: { label: "Note luci", multi: true },
    },
  },
  {
    key: "visualsProiezioni",
    titolo: "Visuals / proiezioni",
    icona: "📽️",
    campi: {
      requisitiTecnici: { label: "Requisiti tecnici", hint: "Proiettore, ledwall, connessioni…", multi: true },
      schermoMinimo: { label: "Schermo minimo", hint: "Es. 4×3 m" },
      note: { label: "Note visuals", multi: true },
    },
  },
  {
    key: "alimentazioneElettrica",
    titolo: "Alimentazione elettrica",
    icona: "⚡",
    campi: {
      potenzaRichiesta: { label: "Potenza richiesta", hint: "Es. 6 kW, 2 linee separate" },
      note: { label: "Note alimentazione", multi: true },
    },
  },
  {
    key: "tempi",
    titolo: "Tempi",
    icona: "⏱️",
    campi: {
      montaggio: { label: "Montaggio", hint: "Es. 60 min" },
      soundcheck: { label: "Soundcheck", hint: "Es. 45 min" },
      smontaggio: { label: "Smontaggio", hint: "Es. 40 min" },
    },
  },
];

const REF = () => doc(db(), "config", "schedaTecnica");

export default function Scheda() {
  const { data, loading, error } = useDocument<SchedaTecnica>("config", "schedaTecnica");
  const save = useSave();

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data)
    return (
      <div className="page">
        <header className="page-head">
          <h1>Scheda tecnica</h1>
        </header>
        <div className="card">
          <p>La scheda tecnica non è ancora nel database.</p>
          <button className="btn primary" onClick={() => save(setDoc(REF(), schedaSeed), "Scheda creata")}>
            Crea scheda vuota
          </button>
        </div>
      </div>
    );

  const setField = (path: string, value: unknown) =>
    save(updateDoc(REF(), { [path]: value, aggiornato: new Date().toISOString() }));

  return (
    <div className="page">
      <header className="page-head">
        <h1>Scheda tecnica</h1>
        <p className="muted">
          {data.bandNome} ·{" "}
          {data.aggiornato ? `aggiornata il ${new Date(data.aggiornato).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}` : "mai compilata"}
        </p>
      </header>

      <p className="hint-box small">Ogni campo si salva da solo mentre scrivi. Le modifiche sono visibili subito a tutta la band.</p>

      <Formazione membri={data.formazione ?? []} onSave={(f) => setField("formazione", f)} />

      {SEZIONI.map((sez) => {
        const valori = (data[sez.key] ?? {}) as Record<string, string>;
        const compilati = Object.keys(sez.campi).filter((k) => valori[k]?.trim()).length;
        return (
          <details key={sez.key} className="card section">
            <summary>
              <span className="sec-icon">{sez.icona}</span>
              <span className="grow">{sez.titolo}</span>
              <span className={`fill-count ${compilati ? "some" : ""}`}>
                {compilati}/{Object.keys(sez.campi).length}
              </span>
            </summary>
            <div className="section-body">
              {Object.entries(sez.campi).map(([k, c]) => (
                <SyncedField
                  key={k}
                  label={c.label}
                  placeholder={c.hint}
                  multiline={c.multi}
                  rows={2}
                  value={valori[k] ?? ""}
                  onSave={(v) => setField(`${sez.key}.${k}`, v)}
                />
              ))}
              {sez.key === "stagePlot" && /^https?:\/\//.test(valori.immagineUrl ?? "") && (
                <a href={valori.immagineUrl} target="_blank" rel="noreferrer" className="ext small">
                  Apri immagine ↗
                </a>
              )}
            </div>
          </details>
        );
      })}

      <section className="card section-static">
        <h3>📝 Note generali</h3>
        <SyncedField multiline rows={5} value={data.noteGenerali ?? ""} onSave={(v) => setField("noteGenerali", v)} />
      </section>
    </div>
  );
}

function Formazione({ membri, onSave }: { membri: MembroFormazione[]; onSave: (m: MembroFormazione[]) => void }) {
  // Copia locale per editare la lista; si riallinea quando arriva un aggiornamento remoto.
  const [list, setList] = useState(membri);
  const key = JSON.stringify(membri);
  useEffect(() => setList(membri), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: MembroFormazione[]) => {
    setList(next);
    onSave(next);
  };

  return (
    <details className="card section" open>
      <summary>
        <span className="sec-icon">🎸</span>
        <span className="grow">Formazione</span>
        <span className={`fill-count ${list.length ? "some" : ""}`}>{list.length} {list.length === 1 ? "membro" : "membri"}</span>
      </summary>
      <div className="section-body">
        {list.length === 0 && <p className="muted small">Nessun membro inserito.</p>}
        {list.map((m, i) => (
          <div key={i} className="member-row">
            <SyncedField
              placeholder="Nome"
              value={m.nome}
              onSave={(v) => commit(list.map((x, j) => (j === i ? { ...x, nome: v } : x)))}
            />
            <SyncedField
              placeholder="Ruolo / strumento"
              value={m.ruolo}
              onSave={(v) => commit(list.map((x, j) => (j === i ? { ...x, ruolo: v } : x)))}
            />
            <button
              className="icon-btn"
              aria-label="Rimuovi membro"
              onClick={() => {
                if (confirm(`Rimuovere ${m.nome || "questo membro"}?`)) commit(list.filter((_, j) => j !== i));
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button className="btn ghost" onClick={() => commit([...list, { nome: "", ruolo: "" }])}>
          + Aggiungi membro
        </button>
      </div>
    </details>
  );
}
