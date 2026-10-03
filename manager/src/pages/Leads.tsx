import { Fragment, useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/hooks";
import { PRIORITA, STATI_CONTATTO, type Lead, type StatoContatto } from "../lib/types";
import { PrioBadge, StatoBadge, prioClass, statoClass } from "../components/Badges";
import { SyncedField } from "../components/SyncedField";
import { Segmented } from "../components/Segmented";
import { useSave } from "../components/Toast";
import { dataIt, norm, today } from "../lib/format";
import { Loading, ErrorBox } from "../components/States";

const TUTTI = "";

export default function Leads() {
  const { data: leads, loading, error } = useCollection<Lead>("leads");
  const [q, setQ] = useState("");
  const [prio, setPrio] = useState<string>(TUTTI);
  const [regione, setRegione] = useState(TUTTI);
  const [tipo, setTipo] = useState(TUTTI);
  const [stato, setStato] = useState(TUTTI);
  const [open, setOpen] = useState<string | null>(null);
  const [table, setTable] = useState(false);

  const regioni = useMemo(() => [...new Set(leads.map((l) => l.regione))].sort(), [leads]);
  const tipi = useMemo(() => [...new Set(leads.map((l) => l.tipo))].sort(), [leads]);

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return leads
      .filter(
        (l) =>
          (!prio || l.priorita === prio) &&
          (!regione || l.regione === regione) &&
          (!tipo || l.tipo === tipo) &&
          (!stato || l.statoContatto === stato) &&
          (!nq ||
            norm(
              [l.nome, l.tipo, l.comune, l.regione, l.genere, l.contatto, l.noteRicerca, l.notaUtente, l.periodo2026].join(" "),
            ).includes(nq)),
      )
      .sort((a, b) => a.ordine - b.ordine);
  }, [leads, q, prio, regione, tipo, stato]);

  const filtriAttivi = [prio, regione, tipo, stato].filter(Boolean).length;

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Locali</h1>
        <p className="muted">
          {filtered.length} di {leads.length} lead
        </p>
      </header>

      <div className="search-wrap">
        <input
          className="input search"
          type="search"
          placeholder="Cerca nome, comune, genere, contatto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="chips" data-noswipe>
        <button className={`chip ${!prio ? "on" : ""}`} onClick={() => setPrio(TUTTI)}>
          Tutte
        </button>
        {PRIORITA.map((p) => (
          <button key={p} className={`chip ${prioClass[p]} ${prio === p ? "on" : ""}`} onClick={() => setPrio(prio === p ? TUTTI : p)}>
            {p}
          </button>
        ))}
      </div>

      <div className="filters">
        <select className="input" value={stato} onChange={(e) => setStato(e.target.value)}>
          <option value="">Tutti gli stati</option>
          {STATI_CONTATTO.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" value={regione} onChange={(e) => setRegione(e.target.value)}>
          <option value="">Tutte le regioni</option>
          {regioni.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tutti i tipi</option>
          {tipi.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="toolbar">
        {filtriAttivi > 0 || q ? (
          <button
            className="link-btn"
            onClick={() => {
              setPrio(TUTTI);
              setRegione(TUTTI);
              setTipo(TUTTI);
              setStato(TUTTI);
              setQ("");
            }}
          >
            Azzera filtri
          </button>
        ) : (
          <span />
        )}
        <div className="view-toggle desktop-only">
          <button className={!table ? "on" : ""} onClick={() => setTable(false)}>
            Card
          </button>
          <button className={table ? "on" : ""} onClick={() => setTable(true)}>
            Tabella
          </button>
        </div>
      </div>

      {filtered.length === 0 && <p className="empty">Nessun lead corrisponde ai filtri.</p>}

      {table ? (
        <LeadTable leads={filtered} open={open} setOpen={setOpen} />
      ) : (
        <div className="list">
          {filtered.map((l) => (
            <LeadCard key={l.id} lead={l} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, open, onToggle }: { lead: Lead; open: boolean; onToggle: () => void }) {
  return (
    <article className={`card lead-card ${prioClass[lead.priorita]} ${open ? "open" : ""}`}>
      <button className="lead-summary" onClick={onToggle} aria-expanded={open}>
        <div className="lead-top">
          <PrioBadge p={lead.priorita} />
          <StatoBadge s={lead.statoContatto} />
        </div>
        <h3>{lead.nome}</h3>
        <p className="muted small">
          {lead.comune} · {lead.regione}
        </p>
        <p className="muted small">{lead.tipo}</p>
        {lead.notaUtente && !open && <p className="note-preview">📝 {lead.notaUtente}</p>}
        <span className="chev" aria-hidden>
          ⌄
        </span>
      </button>
      {open && <LeadDetail lead={lead} />}
    </article>
  );
}

function LeadDetail({ lead }: { lead: Lead }) {
  const save = useSave();
  const ref = doc(db(), "leads", lead.id);

  const setStato = (s: StatoContatto) => {
    const patch: Partial<Lead> = { statoContatto: s };
    // Se si segna un contatto e non c'è ancora una data, proponiamo oggi.
    if (s !== "Da contattare" && !lead.dataUltimoContatto) patch.dataUltimoContatto = today();
    save(updateDoc(ref, patch));
  };

  return (
    <div className="lead-detail">
      <section className="edit-block">
        <span className="field-label">Stato contatto</span>
        <Segmented
          options={STATI_CONTATTO}
          value={lead.statoContatto}
          onChange={setStato}
          classFor={(s) => statoClass[s]}
        />
        <label className="field">
          <span className="field-label">Data ultimo contatto</span>
          <div className="row">
            <input
              className="input"
              type="date"
              value={lead.dataUltimoContatto ?? ""}
              onChange={(e) => save(updateDoc(ref, { dataUltimoContatto: e.target.value || null }))}
            />
            {lead.dataUltimoContatto && (
              <button className="btn ghost" onClick={() => save(updateDoc(ref, { dataUltimoContatto: null }))}>
                Rimuovi
              </button>
            )}
          </div>
        </label>
        <SyncedField
          label="Note della band"
          multiline
          rows={4}
          placeholder="Es. chiamato Marco, richiamare a gennaio…"
          value={lead.notaUtente ?? ""}
          onSave={(v) => save(updateDoc(ref, { notaUtente: v }))}
        />
      </section>

      <dl className="info">
        <Info k="Contatto" v={lead.contatto} pre />
        <Info k="Tipo" v={lead.tipo} />
        <Info k="Comune" v={`${lead.comune} (${lead.regione})`} />
        <Info k="Periodo 2026" v={lead.periodo2026} />
        <Info k="Genere ospitato" v={lead.genere} />
        <Info k="Note ricerca" v={lead.noteRicerca} />
        {lead.fonte && (
          <div>
            <dt>Fonte</dt>
            <dd>
              <a href={lead.fonte} target="_blank" rel="noreferrer" className="ext">
                {lead.fonte.replace(/^https?:\/\/(www\.)?/, "")} ↗
              </a>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function Info({ k, v, pre }: { k: string; v: string; pre?: boolean }) {
  if (!v) return null;
  return (
    <div>
      <dt>{k}</dt>
      <dd className={pre ? "pre selectable" : undefined}>{v}</dd>
    </div>
  );
}

function LeadTable({ leads, open, setOpen }: { leads: Lead[]; open: string | null; setOpen: (id: string | null) => void }) {
  return (
    <div className="table-wrap">
      <table className="lead-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Priorità</th>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Comune</th>
            <th>Regione</th>
            <th>Periodo 2026</th>
            <th>Genere</th>
            <th>Contatto</th>
            <th>Stato</th>
            <th>Ultimo contatto</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <Fragment key={l.id}>
              <tr className={`${open === l.id ? "open" : ""}`} onClick={() => setOpen(open === l.id ? null : l.id)}>
                <td>{l.ordine}</td>
                <td>
                  <PrioBadge p={l.priorita} />
                </td>
                <td className="strong">{l.nome}</td>
                <td>{l.tipo}</td>
                <td>{l.comune}</td>
                <td>{l.regione}</td>
                <td>{l.periodo2026}</td>
                <td>{l.genere}</td>
                <td className="clip">{l.contatto}</td>
                <td>
                  <StatoBadge s={l.statoContatto} />
                </td>
                <td>{dataIt(l.dataUltimoContatto)}</td>
              </tr>
              {open === l.id && (
                <tr className="detail-row">
                  <td colSpan={11}>
                    <LeadDetail lead={l} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
