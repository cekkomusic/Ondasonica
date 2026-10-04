import { Link } from "react-router-dom";
import { useState } from "react";
import { useCollection, useDocument } from "../lib/hooks";
import { importaDatiIniziali } from "../lib/seed";
import { useSave } from "../components/Toast";
import { PRIORITA, STATI_CONTATTO, type Attivita, type DataPresa, type Lead, type Spesa } from "../lib/types";
import { attivitaClass, prioClass, statoClass } from "../components/Badges";
import { dataIt, euro, today } from "../lib/format";
import { residui, usePartecipanti } from "./Spese";
import { Loading } from "../components/States";

export default function Home() {
  const leads = useCollection<Lead>("leads");
  const att = useCollection<Attivita>("attivita");
  const spese = useCollection<Spesa>("spese");
  const date = useCollection<DataPresa>("date");
  const { partecipanti } = usePartecipanti();
  const seed = useDocument<{ at: string }>("config", "seed");
  const save = useSave();
  const [importing, setImporting] = useState(false);

  if (!seed.loading && !seed.data && !seed.error)
    return (
      <div className="page">
        <header className="hero">
          <p className="eyebrow">Primo avvio</p>
          <h1 className="brand">
            Onda<span>sonica</span>
          </h1>
        </header>
        <div className="card glow-card form-card">
          <h3>Database vuoto</h3>
          <p className="small">
            Il collegamento a Firebase funziona, ma il database non contiene ancora dati. Premi il tasto per caricare i 61 locali,
            le attività, la scaletta ufficiale, la configurazione spese e la scheda tecnica vuota. Va fatto una sola volta.
          </p>
          <button
            className="btn primary block"
            disabled={importing}
            onClick={() => {
              setImporting(true);
              const p = importaDatiIniziali();
              save(p, "Dati importati 🎉");
              p.catch(() => setImporting(false));
            }}
          >
            {importing ? "Importazione in corso…" : "Importa dati iniziali"}
          </button>
        </div>
      </div>
    );

  if (seed.loading || leads.loading || att.loading || spese.loading || date.loading) return <Loading />;

  const oggi = today();
  const prossimeDate = date.data.filter((d) => d.data >= oggi).sort((a, b) => a.data.localeCompare(b.data));
  const prossima = prossimeDate[0];

  const L = leads.data;
  const tot = L.length;
  const contattati = L.filter((l) => l.statoContatto !== "Da contattare").length;
  const pct = tot ? Math.round((contattati / tot) * 100) : 0;
  const fissate = L.filter((l) => l.statoContatto === "Data fissata").length;

  const aperte = att.data
    .filter((a) => a.stato !== "Completata")
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5);

  const res = residui(spese.data, partecipanti);
  const daVersare = Object.values(res).reduce((a, b) => a + b, 0);
  const speseAperte = spese.data.filter((s) => partecipanti.some((p) => !s.pagamenti?.[p]?.pagato)).length;

  // Prossimi lead da contattare: priorità Alta non ancora contattati.
  const prossimi = L.filter((l) => l.priorita === "Alta" && l.statoContatto === "Da contattare")
    .sort((a, b) => a.ordine - b.ordine)
    .slice(0, 3);

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Stagione 2027</p>
        <h1 className="brand">
          Onda<span>sonica</span>
        </h1>
        <p className="muted">Booking, attività e spese della band</p>
      </header>

      {prossima && (
        <Link to="/concerti" className="card glow-card next-gig">
          <p className="eyebrow">Prossimo concerto</p>
          <h3>{prossima.locale}</h3>
          <p className="muted small">
            {new Date(prossima.data + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            {prossima.indirizzo ? ` · ${prossima.indirizzo}` : ""}
          </p>
          {prossimeDate.length > 1 && <p className="muted tiny">+ altri {prossimeDate.length - 1} in programma</p>}
        </Link>
      )}

      <section className="card glow-card progress-card">
        <div className="ring" style={{ ["--p" as string]: pct }}>
          <span>{pct}%</span>
        </div>
        <div>
          <p className="big">
            <strong>{contattati}</strong> contattati su {tot}
          </p>
          <p className="muted small">
            {fissate > 0 ? `🎉 ${fissate} ${fissate === 1 ? "data fissata" : "date fissate"}` : "Nessuna data fissata, ancora"}
          </p>
          <Link to="/locali" className="link-btn">
            Vai ai locali →
          </Link>
        </div>
      </section>

      <section className="card">
        <h3>Lead per priorità</h3>
        <div className="bars">
          {PRIORITA.map((p) => {
            const n = L.filter((l) => l.priorita === p).length;
            const c = L.filter((l) => l.priorita === p && l.statoContatto !== "Da contattare").length;
            return (
              <div key={p} className={`bar-row ${prioClass[p]}`}>
                <span className="bar-label">{p}</span>
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${tot ? (n / tot) * 100 : 0}%` }}>
                    <div className="bar-done" style={{ width: `${n ? (c / n) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="bar-num">
                  {c}/{n}
                </span>
              </div>
            );
          })}
        </div>
        <p className="muted tiny">Parte piena = già contattati</p>
      </section>

      <section className="card">
        <h3>Stato contatti</h3>
        <div className="stat-grid">
          {STATI_CONTATTO.map((s) => (
            <div key={s} className={`stat ${statoClass[s]}`}>
              <strong>{L.filter((l) => l.statoContatto === s).length}</strong>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </section>

      {prossimi.length > 0 && (
        <section className="card">
          <h3>Da chiamare per primi</h3>
          <ul className="mini-list">
            {prossimi.map((l) => (
              <li key={l.id}>
                <span className="dot prio-alta" />
                <div>
                  <strong>{l.nome}</strong>
                  <p className="muted small">{l.comune}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="row between">
          <h3>Attività aperte</h3>
          <Link to="/attivita" className="link-btn">
            Tutte →
          </Link>
        </div>
        {aperte.length === 0 ? (
          <p className="muted small">Tutto completato 🎉</p>
        ) : (
          <ul className="mini-list">
            {aperte.map((a) => (
              <li key={a.id}>
                <span className={`dot ${attivitaClass[a.stato] ?? "st-todo"}`} />
                <div>
                  <strong>{a.titolo}</strong>
                  <p className="muted small">
                    {a.stato} · {dataIt(a.data)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row between">
          <h3>Spese da saldare</h3>
          <Link to="/spese" className="link-btn">
            Dettagli →
          </Link>
        </div>
        {daVersare > 0 ? (
          <>
            <p className="big">
              <strong className="warn-text">{euro(daVersare)}</strong>{" "}
              <span className="muted small">
                su {speseAperte} {speseAperte === 1 ? "spesa" : "spese"}
              </span>
            </p>
            <div className="debt-grid compact">
              {partecipanti
                .filter((p) => res[p] > 0)
                .map((p) => (
                  <div key={p} className="debt due">
                    <span className="who">{p}</span>
                    <span className="amt">{euro(res[p])}</span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p className="muted small">{spese.data.length ? "Tutti in pari ✓" : "Nessuna spesa registrata."}</p>
        )}
      </section>

      <Link to="/attivita" className="card doc-link">
        <span>✅</span>
        <div className="grow">
          <strong>Attività</strong>
          <p className="muted small">Cosa è stato fatto e cosa resta da fare</p>
        </div>
        <span>→</span>
      </Link>

      <Link to="/documenti" className="card doc-link">
        <span>📄</span>
        <div className="grow">
          <strong>Documenti di riferimento</strong>
          <p className="muted small">Strategia 2027, EPK, template email</p>
        </div>
        <span>→</span>
      </Link>
    </div>
  );
}
