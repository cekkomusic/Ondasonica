import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/hooks";
import { STATI_ATTIVITA, type Attivita as A, type StatoAttivita } from "../lib/types";
import { attivitaClass } from "../components/Badges";
import { Segmented } from "../components/Segmented";
import { SyncedField } from "../components/SyncedField";
import { useSave } from "../components/Toast";
import { dataIt, today } from "../lib/format";
import { ErrorBox, Loading } from "../components/States";

type Filtro = "Aperte" | "Tutte" | "Completate";

export default function Attivita() {
  const { data, loading, error } = useCollection<A>("attivita");
  const [filtro, setFiltro] = useState<Filtro>("Tutte");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const list = useMemo(
    () =>
      data
        .filter((a) => (filtro === "Tutte" ? true : filtro === "Completate" ? a.stato === "Completata" : a.stato !== "Completata"))
        .sort((a, b) => b.data.localeCompare(a.data) || (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [data, filtro],
  );

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;

  const aperte = data.filter((a) => a.stato !== "Completata").length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Attività</h1>
        <p className="muted">
          {aperte} aperte · {data.length - aperte} completate
        </p>
      </header>

      {adding ? (
        <NuovaAttivita onDone={() => setAdding(false)} />
      ) : (
        <button className="btn primary block" onClick={() => setAdding(true)}>
          + Nuova attività
        </button>
      )}

      <Segmented options={["Tutte", "Aperte", "Completate"] as const} value={filtro} onChange={setFiltro} />

      {list.length === 0 && <p className="empty">Nessuna attività.</p>}

      <div className="list timeline">
        {list.map((a) => (
          <AttivitaItem key={a.id} a={a} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} />
        ))}
      </div>
    </div>
  );
}

function AttivitaItem({ a, open, onToggle }: { a: A; open: boolean; onToggle: () => void }) {
  const save = useSave();
  const ref = doc(db(), "attivita", a.id);
  const cls = attivitaClass[a.stato] ?? "st-todo";

  return (
    <article className={`card att-card ${cls} ${open ? "open" : ""}`}>
      <button className="att-summary" onClick={onToggle} aria-expanded={open}>
        <span className={`dot ${cls}`} />
        <div className="grow">
          <h3 className={a.stato === "Completata" ? "done" : ""}>{a.titolo}</h3>
          <p className="muted small">
            {dataIt(a.data)} · <span className={`stato-text ${cls}`}>{a.stato}</span>
          </p>
          {!open && a.note && <p className="note-preview">📝 {a.note}</p>}
        </div>
        <span className="chev" aria-hidden>
          ⌄
        </span>
      </button>
      {open && (
        <div className="att-detail">
          <span className="field-label">Stato</span>
          <Segmented
            options={STATI_ATTIVITA}
            value={a.stato}
            onChange={(s: StatoAttivita) => save(updateDoc(ref, { stato: s }))}
            classFor={(s) => attivitaClass[s]}
          />
          <SyncedField
            label="Descrizione"
            multiline
            value={a.descrizione ?? ""}
            onSave={(v) => save(updateDoc(ref, { descrizione: v }))}
          />
          <SyncedField
            label="Note"
            multiline
            placeholder="Aggiungi una nota…"
            value={a.note ?? ""}
            onSave={(v) => save(updateDoc(ref, { note: v }))}
          />
          <label className="field">
            <span className="field-label">Data</span>
            <input
              className="input"
              type="date"
              value={a.data}
              onChange={(e) => e.target.value && save(updateDoc(ref, { data: e.target.value }))}
            />
          </label>
          <button
            className="btn danger ghost"
            onClick={() => {
              if (confirm(`Eliminare l'attività "${a.titolo}"?`)) save(deleteDoc(ref), "Eliminata");
            }}
          >
            Elimina attività
          </button>
        </div>
      )}
    </article>
  );
}

function NuovaAttivita({ onDone }: { onDone: () => void }) {
  const save = useSave();
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [stato, setStato] = useState<StatoAttivita>("Da fare");
  const [data, setData] = useState(today());

  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titolo.trim()) return;
        save(
          addDoc(collection(db(), "attivita"), {
            titolo: titolo.trim(),
            descrizione: descrizione.trim(),
            stato,
            data,
            note: "",
            createdAt: Date.now(),
          }),
          "Attività aggiunta",
        );
        onDone();
      }}
    >
      <h3>Nuova attività</h3>
      <label className="field">
        <span className="field-label">Titolo *</span>
        <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} autoFocus required />
      </label>
      <label className="field">
        <span className="field-label">Descrizione</span>
        <textarea className="input" rows={3} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
      </label>
      <span className="field-label">Stato</span>
      <Segmented options={STATI_ATTIVITA} value={stato} onChange={setStato} classFor={(s) => attivitaClass[s]} />
      <label className="field">
        <span className="field-label">Data</span>
        <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
      </label>
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onDone}>
          Annulla
        </button>
        <button type="submit" className="btn primary">
          Aggiungi
        </button>
      </div>
    </form>
  );
}
