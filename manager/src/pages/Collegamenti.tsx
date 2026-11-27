import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDocument } from "../lib/hooks";
import { DISPOSITIVI, etichetta, nuovoId, predefiniti, salvaCollegamenti, type Capo, type Collegamenti as Dati } from "../lib/collegamenti";
import { SchemaCollegamenti } from "../components/SchemaCollegamenti";
import { SyncedField } from "../components/SyncedField";
import { useSave } from "../components/Toast";
import { ErrorBox, Loading } from "../components/States";

export default function Collegamenti() {
  const doc = useDocument<Dati>("config", "collegamenti");
  const save = useSave();
  const [sel, setSel] = useState<Capo | null>(null);
  const [attivo, setAttivo] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.6);

  const dati: Dati = useMemo(() => {
    if (doc.data?.cavi) return { cavi: doc.data.cavi, canali: doc.data.canali ?? {} };
    return predefiniti();
  }, [doc.data]);

  if (doc.loading) return <Loading />;
  if (doc.error) return <ErrorBox msg={doc.error} />;

  const salvaCavi = (cavi: Dati["cavi"], msg = "Collegamenti salvati") => save(salvaCollegamenti({ cavi, canali: dati.canali }), msg);
  const salvaCanale = (chiave: string, nome: string) => save(salvaCollegamenti({ cavi: dati.cavi, canali: { ...dati.canali, [chiave]: nome } }), "Canale rinominato");

  const tocca = (c: Capo, lato: "in" | "out") => {
    if (lato === "out") {
      setSel(sel && sel.dev === c.dev && sel.porta === c.porta ? null : c);
      setAttivo(null);
      return;
    }
    if (!sel) {
      // ingresso toccato senza uscita selezionata: evidenzia il cavo che arriva lì
      const esistente = dati.cavi.find((x) => x.a.dev === c.dev && x.a.porta === c.porta);
      setAttivo(esistente?.id ?? null);
      return;
    }
    if (sel.dev === c.dev) return setSel(null);
    const occupato = dati.cavi.find((x) => x.a.dev === c.dev && x.a.porta === c.porta);
    if (occupato && !confirm(`Questo ingresso è già collegato (${occupato.nome || etichetta(occupato.da, dati.canali)}). Sostituire il cavo?`)) return;
    const nome = dati.canali[`${c.dev}:${c.porta}`] || "";
    const nuovo = { id: nuovoId(), da: sel, a: c, nome };
    salvaCavi([...dati.cavi.filter((x) => x !== occupato), nuovo], "Cavo collegato");
    setSel(null);
    setAttivo(nuovo.id);
  };

  const mixer = DISPOSITIVI.filter((d) => d.canali);

  return (
    <div className="page">
      <header className="page-head">
        <Link to="/scheda" className="link-btn small">
          ← Scheda tecnica
        </Link>
        <h1>Collegamenti</h1>
        <p className="muted">Schema dei cavi tra strumenti, mixer, in-ear e spie.</p>
      </header>

      <p className="hint-box small">
        {sel
          ? `Uscita scelta: ${etichetta(sel, dati.canali)}. Ora tocca un ingresso (pallino vuoto) per tirare il cavo.`
          : "Per tirare un cavo: tocca un'uscita (pallino pieno, a destra di un riquadro), poi un ingresso (pallino a sinistra). Da un'uscita possono partire più cavi. Tocca un cavo per evidenziarlo."}
      </p>

      <div className="schema-tools">
        <button className="btn sm" onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.15).toFixed(2)))}>
          −
        </button>
        <span className="small muted">Zoom {Math.round(zoom * 100)}%</span>
        <button className="btn sm" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}>
          +
        </button>
        {sel && (
          <button className="btn sm" onClick={() => setSel(null)}>
            Annulla
          </button>
        )}
      </div>

      <div className="schema-wrap" data-noswipe>
        <div style={{ zoom } as React.CSSProperties}>
          <SchemaCollegamenti dati={dati} selezione={sel} cavoAttivo={attivo} onPorta={tocca} onCavo={(id) => setAttivo(attivo === id ? null : id)} />
        </div>
      </div>

      <section className="card">
        <h3>Cavi ({dati.cavi.length})</h3>
        <ul className="cavi-list">
          {dati.cavi.map((c) => (
            <li key={c.id} className={attivo === c.id ? "on" : ""} onClick={() => setAttivo(c.id)}>
              <SyncedField
                value={c.nome}
                placeholder="Nome del cavo"
                onSave={(v) => salvaCavi(dati.cavi.map((x) => (x.id === c.id ? { ...x, nome: v } : x)), "Cavo rinominato")}
              />
              <p className="small muted">
                {etichetta(c.da, dati.canali)} → {etichetta(c.a, dati.canali)}
              </p>
              <button
                className="link-btn small danger"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Eliminare il cavo "${c.nome || "senza nome"}"?`)) salvaCavi(dati.cavi.filter((x) => x.id !== c.id), "Cavo eliminato");
                }}
              >
                Elimina
              </button>
            </li>
          ))}
        </ul>
      </section>

      {mixer.map((m) => (
        <details key={m.id} className="card section">
          <summary>
            <span className="grow">Nomi dei canali · {m.nome}</span>
          </summary>
          <div className="section-body canali-grid">
            {[...m.ingressi, ...m.uscite].map((p) => (
              <SyncedField
                key={p.id}
                label={p.label}
                placeholder="Nome canale"
                value={dati.canali[`${m.id}:${p.id}`] ?? ""}
                onSave={(v) => salvaCanale(`${m.id}:${p.id}`, v)}
              />
            ))}
          </div>
        </details>
      ))}

      <button
        className="link-btn small"
        onClick={() => {
          if (confirm("Tornare ai collegamenti di base? I cavi e i nomi attuali verranno sostituiti.")) save(salvaCollegamenti(predefiniti()), "Collegamenti di base ripristinati");
        }}
      >
        ↺ Ripristina collegamenti di base
      </button>
    </div>
  );
}
