import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection, useDocument } from "../lib/hooks";
import { meseId, type MeseCalendario } from "../lib/calendario";
import type { DataPresa } from "../lib/types";
import { usePartecipanti } from "./Spese";
import { SyncedField } from "../components/SyncedField";
import { useSave } from "../components/Toast";
import { cent, dataIt, euro, today } from "../lib/format";
import { ErrorBox, Loading } from "../components/States";

// Persone esterne alla band che possono procurare date (non partecipano alle spese).
const ESTERNI = ["FABRIZIO"];

const giorno = (iso: string) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";

const parseEuro = (s: string) => {
  const n = Number(s.replace(/[€\s.]/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) ? cent(n) : null;
};

export default function DatePrese() {
  const { data, loading, error } = useCollection<DataPresa>("date");
  const { partecipanti: membri } = usePartecipanti();
  const partecipanti = useMemo(() => [...membri, ...ESTERNI.filter((e) => !membri.includes(e))], [membri]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [vista, setVista] = useState<"card" | "tabella">("card");

  const oggi = today();
  const { prossime, passate } = useMemo(() => {
    const s = [...data].sort((a, b) => a.data.localeCompare(b.data) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    return { prossime: s.filter((d) => d.data >= oggi), passate: s.filter((d) => d.data < oggi).reverse() };
  }, [data, oggi]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;

  const totCachet = cent(prossime.reduce((t, d) => t + (d.cachet ?? 0), 0));

  return (
    <div className="page">
      <header className="page-head">
        <h1>Concerti</h1>
        <p className="muted">
          {prossime.length} in programma{totCachet > 0 ? ` · ${euro(totCachet)} di cachet` : ""}
          {passate.length ? ` · ${passate.length} passate` : ""}
        </p>
      </header>

      {adding ? (
        <NuovaData partecipanti={partecipanti} onDone={() => setAdding(false)} />
      ) : (
        <button className="btn primary block" onClick={() => setAdding(true)}>
          + Nuovo concerto
        </button>
      )}

      <div className="toolbar">
        <span />
        <div className="view-toggle desktop-only">
          <button className={vista === "card" ? "on" : ""} onClick={() => setVista("card")}>
            Card
          </button>
          <button className={vista === "tabella" ? "on" : ""} onClick={() => setVista("tabella")}>
            Tabella
          </button>
        </div>
      </div>

      {data.length === 0 && !adding && <p className="empty">Nessun concerto ancora. Il primo arriverà 🤘</p>}

      {vista === "tabella" ? (
        <TabellaDate righe={[...prossime, ...passate]} oggi={oggi} />
      ) : (
        <>
          {prossime.length > 0 && <h2 className="section-title">In programma</h2>}
          <div className="list">
            {prossime.map((d) => (
              <DataCard key={d.id} d={d} partecipanti={partecipanti} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} />
            ))}
          </div>
          {passate.length > 0 && <h2 className="section-title muted">Passate</h2>}
          <div className="list">
            {passate.map((d) => (
              <DataCard key={d.id} d={d} partecipanti={partecipanti} passata open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DataCard({
  d,
  partecipanti,
  passata,
  open,
  onToggle,
}: {
  d: DataPresa;
  partecipanti: string[];
  passata?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const save = useSave();
  const ref = doc(db(), "date", d.id);
  const [g, m] = d.data ? [d.data.slice(8, 10), new Date(d.data + "T12:00:00").toLocaleDateString("it-IT", { month: "short" })] : ["?", ""];

  return (
    <article className={`card data-card ${passata ? "passata" : ""} ${open ? "open" : ""}`}>
      <button className="data-summary" onClick={onToggle} aria-expanded={open}>
        <div className="cal">
          <strong>{g}</strong>
          <span>{m}</span>
        </div>
        <div className="grow">
          <h3>{d.locale || "Locale da definire"}</h3>
          <p className="muted small">{giorno(d.data)}</p>
          {d.indirizzo && <p className="muted small">📍 {d.indirizzo}</p>}
          <div className="data-tags">
            {d.cachet != null && <span className="badge prio-alta">{euro(d.cachet)}</span>}
            <span className={`badge ${d.service ? "st-done" : "st-no"}`}>Service {d.service ? "sì" : "no"}</span>
            {d.presaDa && <span className="badge st-reply">da {d.presaDa}</span>}
          </div>
        </div>
        <span className="chev" aria-hidden>
          ⌄
        </span>
      </button>

      {open && (
        <div className="lead-detail">
          <label className="field">
            <span className="field-label">Data</span>
            <input className="input" type="date" value={d.data} onChange={(e) => e.target.value && save(updateDoc(ref, { data: e.target.value }))} />
          </label>
          <SyncedField label="Locale" value={d.locale} onSave={(v) => save(updateDoc(ref, { locale: v }))} />
          <SyncedField label="Indirizzo" value={d.indirizzo} onSave={(v) => save(updateDoc(ref, { indirizzo: v }))} />
          {d.indirizzo && (
            <a className="ext small" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.indirizzo)}`} target="_blank" rel="noreferrer">
              Apri in Maps ↗
            </a>
          )}
          <SyncedField
            label="Cachet concordato (€)"
            type="text"
            value={d.cachet != null ? String(d.cachet).replace(".", ",") : ""}
            placeholder="0,00"
            onSave={(v) => save(updateDoc(ref, { cachet: parseEuro(v) }))}
          />
          <div className="field">
            <span className="field-label">Service</span>
            <SiNo value={d.service} onChange={(v) => save(updateDoc(ref, { service: v }))} />
          </div>
          <SyncedField label="Referente" value={d.referente} placeholder="Nome e telefono/email" onSave={(v) => save(updateDoc(ref, { referente: v }))} />
          <div className="field">
            <span className="field-label">Presa da</span>
            <Membri partecipanti={partecipanti} value={d.presaDa} onChange={(v) => save(updateDoc(ref, { presaDa: v }))} />
          </div>
          <button
            className="btn danger ghost"
            onClick={() => {
              if (confirm(`Eliminare il concerto "${d.locale}" del ${dataIt(d.data)}?`)) save(deleteDoc(ref), "Concerto eliminato");
            }}
          >
            Elimina concerto
          </button>
        </div>
      )}
    </article>
  );
}

function SiNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="segmented">
      <button type="button" className={`seg st-done ${value ? "on" : ""}`} onClick={() => !value && onChange(true)}>
        Sì
      </button>
      <button type="button" className={`seg st-no ${!value ? "on" : ""}`} onClick={() => value && onChange(false)}>
        No
      </button>
    </div>
  );
}

function Membri({ partecipanti, value, onChange }: { partecipanti: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="segmented">
      {partecipanti.map((p) => (
        <button type="button" key={p} className={`seg ${value === p ? "on" : ""}`} onClick={() => value !== p && onChange(p)}>
          {p}
        </button>
      ))}
    </div>
  );
}

function NuovaData({ partecipanti, onDone }: { partecipanti: string[]; onDone: () => void }) {
  const save = useSave();
  const [f, setF] = useState({ data: "", locale: "", indirizzo: "", cachet: "", service: false, referente: "", presaDa: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const valido = f.data && f.locale.trim();
  // Avvisa se qualcuno si è segnato indisponibile nel Calendario per quel giorno.
  const cal = useDocument<MeseCalendario>("config", meseId(f.data || today()));
  const indisponibili = f.data ? Object.entries(cal.data?.[f.data] ?? {}).filter(([, i]) => i.indisponibile).map(([m]) => m) : [];

  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valido) return;
        save(
          addDoc(collection(db(), "date"), {
            data: f.data,
            locale: f.locale.trim(),
            indirizzo: f.indirizzo.trim(),
            cachet: parseEuro(f.cachet),
            service: f.service,
            referente: f.referente.trim(),
            presaDa: f.presaDa,
            createdAt: Date.now(),
          }),
          "Concerto aggiunto 🎉",
        );
        onDone();
      }}
    >
      <h3>Nuovo concerto</h3>
      <label className="field">
        <span className="field-label">Data *</span>
        <input className="input" type="date" min={today()} value={f.data} onChange={(e) => set("data", e.target.value)} required />
      </label>
      {indisponibili.length > 0 && (
        <p className="indisp-warn small">⚠️ In questo giorno si sono segnati indisponibili: {indisponibili.join(", ")}</p>
      )}
      <label className="field">
        <span className="field-label">Locale *</span>
        <input className="input" value={f.locale} onChange={(e) => set("locale", e.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">Indirizzo</span>
        <input className="input" value={f.indirizzo} onChange={(e) => set("indirizzo", e.target.value)} placeholder="Via, città" />
      </label>
      <label className="field">
        <span className="field-label">Cachet concordato (€)</span>
        <input className="input" inputMode="decimal" value={f.cachet} onChange={(e) => set("cachet", e.target.value)} placeholder="0,00" />
      </label>
      <div className="field">
        <span className="field-label">Service</span>
        <SiNo value={f.service} onChange={(v) => set("service", v)} />
      </div>
      <label className="field">
        <span className="field-label">Referente</span>
        <input className="input" value={f.referente} onChange={(e) => set("referente", e.target.value)} placeholder="Nome e telefono/email" />
      </label>
      <div className="field">
        <span className="field-label">Presa da</span>
        <Membri partecipanti={partecipanti} value={f.presaDa} onChange={(v) => set("presaDa", v)} />
      </div>
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onDone}>
          Annulla
        </button>
        <button type="submit" className="btn primary" disabled={!valido}>
          Aggiungi
        </button>
      </div>
    </form>
  );
}

function TabellaDate({ righe, oggi }: { righe: DataPresa[]; oggi: string }) {
  return (
    <div className="table-wrap">
      <table className="lead-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Locale</th>
            <th>Indirizzo</th>
            <th>Cachet concordato</th>
            <th>Service</th>
            <th>Referente</th>
            <th>Presa da</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((d) => (
            <tr key={d.id} className={d.data < oggi ? "passata" : ""}>
              <td>{dataIt(d.data)}</td>
              <td className="strong">{d.locale}</td>
              <td>{d.indirizzo}</td>
              <td>{d.cachet != null ? euro(d.cachet) : ""}</td>
              <td>{d.service ? "Sì" : "No"}</td>
              <td>{d.referente}</td>
              <td>{d.presaDa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
