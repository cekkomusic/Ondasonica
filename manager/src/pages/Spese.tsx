import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, FieldPath, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection, useDocument } from "../lib/hooks";
import type { Spesa, SpeseConfig } from "../lib/types";
import { SyncedField } from "../components/SyncedField";
import { useSave } from "../components/Toast";
import { cent, dataIt, euro, today } from "../lib/format";
import { ErrorBox, Loading } from "../components/States";
import { IbanBox } from "../components/IbanBox";
import { aggiungiVoce, rimuoviVoce, useRubrica, type VoceRubrica } from "../lib/iban";

export const PARTECIPANTI_DEFAULT = ["SBERLA", "CEKKO", "ADRY", "VALTER", "PHIL"];

export function usePartecipanti() {
  const cfg = useDocument<SpeseConfig>("config", "spese");
  const list = cfg.data?.partecipanti?.length ? cfg.data.partecipanti : PARTECIPANTI_DEFAULT;
  return { partecipanti: list, loading: cfg.loading };
}

/** Quota a testa: divisione sempre equa sui partecipanti. */
export const quota = (s: Spesa, n: number) => cent((Number(s.importoTotale) || 0) / n);

/** Quanto deve ancora versare ciascuno, sommando le quote non pagate. */
export function residui(spese: Spesa[], partecipanti: string[]) {
  const out: Record<string, number> = Object.fromEntries(partecipanti.map((p) => [p, 0]));
  for (const s of spese) {
    const q = quota(s, partecipanti.length);
    for (const p of partecipanti) if (!s.pagamenti?.[p]?.pagato) out[p] = cent(out[p] + q);
  }
  return out;
}

export default function Spese() {
  const { data: spese, loading, error } = useCollection<Spesa>("spese");
  const { partecipanti } = usePartecipanti();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () => [...spese].sort((a, b) => b.data.localeCompare(a.data) || (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [spese],
  );
  const res = useMemo(() => residui(spese, partecipanti), [spese, partecipanti]);
  const totale = cent(spese.reduce((t, s) => t + (Number(s.importoTotale) || 0), 0));
  const daSaldare = cent(Object.values(res).reduce((a, b) => a + b, 0));

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Spese</h1>
        <p className="muted">
          Divisione equa su {partecipanti.length} · totale {euro(totale)}
        </p>
      </header>

      <section className="card glow-card">
        <div className="row between">
          <h3>Ancora da versare</h3>
          <strong className={daSaldare > 0 ? "warn-text" : "ok-text"}>{euro(daSaldare)}</strong>
        </div>
        <div className="debt-grid">
          {partecipanti.map((p) => (
            <div key={p} className={`debt ${res[p] > 0 ? "due" : "clear"}`}>
              <span className="who">{p}</span>
              <span className="amt">{res[p] > 0 ? euro(res[p]) : "✓ in pari"}</span>
            </div>
          ))}
        </div>
      </section>

      {adding ? (
        <NuovaSpesa partecipanti={partecipanti} onDone={() => setAdding(false)} />
      ) : (
        <button className="btn primary block" onClick={() => setAdding(true)}>
          + Nuova spesa
        </button>
      )}

      {sorted.length === 0 && !adding && <p className="empty">Nessuna spesa registrata. Aggiungi la prima!</p>}

      <div className="list">
        {sorted.map((s) => (
          <SpesaCard
            key={s.id}
            s={s}
            partecipanti={partecipanti}
            open={open === s.id}
            onToggle={() => setOpen(open === s.id ? null : s.id)}
          />
        ))}
      </div>

      <RubricaIban />
    </div>
  );
}

function SpesaCard({ s, partecipanti, open, onToggle }: { s: Spesa; partecipanti: string[]; open: boolean; onToggle: () => void }) {
  const save = useSave();
  const ref = doc(db(), "spese", s.id);
  const q = quota(s, partecipanti.length);
  const pagati = partecipanti.filter((p) => s.pagamenti?.[p]?.pagato).length;
  const saldata = pagati === partecipanti.length;

  return (
    <article className={`card spesa-card ${saldata ? "saldata" : ""} ${open ? "open" : ""}`}>
      <button className="spesa-summary" onClick={onToggle} aria-expanded={open}>
        <div className="row between">
          <h3>{s.descrizione}</h3>
          <strong className="amount">{euro(s.importoTotale)}</strong>
        </div>
        <p className="muted small">
          {dataIt(s.data)} · inserita da {s.inseritoDa || "—"} · {euro(q)} a testa
        </p>
        <div className="dots" aria-label={`${pagati} su ${partecipanti.length} hanno pagato`}>
          {partecipanti.map((p) => (
            <span key={p} className={`pdot ${s.pagamenti?.[p]?.pagato ? "paid" : ""}`} title={p}>
              {p.slice(0, 2)}
            </span>
          ))}
          <span className="muted small dots-count">
            {pagati}/{partecipanti.length}
          </span>
        </div>
      </button>

      {s.iban && (
        <div className="spesa-iban">
          <IbanBox iban={s.iban} nome={`Versa a ${s.ibanNome || s.inseritoDa || "—"}`} />
        </div>
      )}

      {open && (
        <div className="spesa-detail">
          <SyncedField
            label="IBAN (facoltativo)"
            placeholder="Es. IT60 X054 2811 1010 0000 0123 456"
            value={s.iban ?? ""}
            onSave={(v) => save(updateDoc(ref, { iban: v.trim(), ibanNome: "" }))}
          />
          {partecipanti.map((p) => {
            const pg = s.pagamenti?.[p] ?? { pagato: false, nota: "" };
            return (
              <div key={p} className={`pay-row ${pg.pagato ? "paid" : ""}`}>
                <div className="row between">
                  <span className="who">{p}</span>
                  <button
                    className={`toggle ${pg.pagato ? "on" : ""}`}
                    role="switch"
                    aria-checked={pg.pagato}
                    onClick={() =>
                      save(updateDoc(ref, new FieldPath("pagamenti", p, "pagato"), !pg.pagato), pg.pagato ? "Segnato non pagato" : `${p}: pagato ✓`)
                    }
                  >
                    <span className="toggle-label">{pg.pagato ? "Pagato" : "Non pagato"}</span>
                    <span className="knob" />
                  </button>
                </div>
                <SyncedField
                  placeholder="Nota (es. pagato in contanti il 3/10)"
                  value={pg.nota ?? ""}
                  onSave={(v) => save(updateDoc(ref, new FieldPath("pagamenti", p, "nota"), v))}
                />
              </div>
            );
          })}
          <button
            className="btn danger ghost"
            onClick={() => {
              if (confirm(`Eliminare la spesa "${s.descrizione}"?`)) save(deleteDoc(ref), "Spesa eliminata");
            }}
          >
            Elimina spesa
          </button>
        </div>
      )}
    </article>
  );
}

function NuovaSpesa({ partecipanti, onDone }: { partecipanti: string[]; onDone: () => void }) {
  const save = useSave();
  const [descrizione, setDescrizione] = useState("");
  const [importo, setImporto] = useState("");
  const [data, setData] = useState(today());
  const [inseritoDa, setInseritoDa] = useState(() => {
    try {
      return localStorage.getItem("ondasonica.me") ?? "";
    } catch {
      return "";
    }
  });

  const [iban, setIban] = useState("");
  const [ibanNome, setIbanNome] = useState("");
  const [inRubrica, setInRubrica] = useState(false);
  const [nomeRubrica, setNomeRubrica] = useState("");
  const { voci } = useRubrica();
  const ibanGiaInRubrica = voci.some((v) => v.iban.replace(/\s/g, "") === iban.replace(/\s/g, ""));
  const tot = Number(importo.replace(",", "."));
  const valido = descrizione.trim() && Number.isFinite(tot) && tot > 0 && inseritoDa;

  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valido) return;
        try {
          localStorage.setItem("ondasonica.me", inseritoDa);
        } catch {
          /* ignorato */
        }
        save(
          addDoc(collection(db(), "spese"), {
            descrizione: descrizione.trim(),
            importoTotale: cent(tot),
            data,
            inseritoDa,
            iban: iban.trim(),
            ibanNome: iban.trim() ? (inRubrica && !ibanGiaInRubrica ? nomeRubrica.trim() : ibanNome) : "",
            pagamenti: Object.fromEntries(partecipanti.map((p) => [p, { pagato: false, nota: "" }])),
            createdAt: Date.now(),
          }),
          "Spesa aggiunta",
        );
        if (iban.trim() && inRubrica && !ibanGiaInRubrica) save(aggiungiVoce(nomeRubrica.trim() || inseritoDa, iban), "IBAN salvato in rubrica");
        onDone();
      }}
    >
      <h3>Nuova spesa</h3>
      <label className="field">
        <span className="field-label">Tipologia / descrizione *</span>
        <input
          className="input"
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          placeholder="Es. affitto sala prove ottobre"
          autoFocus
          required
        />
      </label>
      <div className="row two">
        <label className="field">
          <span className="field-label">Importo totale (€) *</span>
          <input
            className="input"
            inputMode="decimal"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            placeholder="0,00"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Data</span>
          <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
      </div>
      <span className="field-label">Inserita da *</span>
      <div className="segmented">
        {partecipanti.map((p) => (
          <button type="button" key={p} className={`seg ${inseritoDa === p ? "on" : ""}`} onClick={() => setInseritoDa(p)}>
            {p}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field-label">IBAN (facoltativo)</span>
        <input
          className="input"
          value={iban}
          onChange={(e) => {
            setIban(e.target.value);
            setIbanNome("");
          }}
          placeholder="Dove versare la quota, es. IT60 X054 2811 …"
          autoCapitalize="characters"
        />
      </label>
      {voci.length > 0 && (
        <div className="rubrica-pick" data-noswipe>
          <span className="muted small">📒 Dalla rubrica:</span>
          {voci.map((v) => (
            <button
              type="button"
              key={v.id}
              className={`chip ${iban === v.iban ? "on" : ""}`}
              onClick={() => {
                setIban(v.iban);
                setIbanNome(v.nome);
              }}
            >
              {v.nome}
            </button>
          ))}
        </div>
      )}
      {iban.trim() && !ibanGiaInRubrica && (
        <div className="salva-rubrica">
          <label className="check">
            <input type="checkbox" checked={inRubrica} onChange={(e) => setInRubrica(e.target.checked)} />
            Salva questo IBAN nella rubrica
          </label>
          {inRubrica && (
            <input
              className="input"
              value={nomeRubrica}
              onChange={(e) => setNomeRubrica(e.target.value)}
              placeholder={`Nome in rubrica (es. ${inseritoDa || "CEKKO"}, Sala prove…)`}
            />
          )}
        </div>
      )}
      {Number.isFinite(tot) && tot > 0 && (
        <p className="quota-preview">
          Quota a testa: <strong>{euro(cent(tot / partecipanti.length))}</strong>
        </p>
      )}
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

function RubricaIban() {
  const save = useSave();
  const { voci } = useRubrica();
  const [nome, setNome] = useState("");
  const [iban, setIban] = useState("");

  return (
    <details className="card section rubrica">
      <summary>
        <span className="sec-icon">📒</span>
        <span className="grow">Rubrica IBAN</span>
        <span className={`fill-count ${voci.length ? "some" : ""}`}>{voci.length}</span>
      </summary>
      <div className="section-body">
        {voci.length === 0 && <p className="muted small">Nessun IBAN salvato.</p>}
        {voci.map((v: VoceRubrica) => (
          <div key={v.id} className="rubrica-row">
            <IbanBox iban={v.iban} nome={v.nome} />
            <button
              className="icon-btn"
              aria-label={`Elimina ${v.nome}`}
              onClick={() => {
                if (confirm(`Eliminare l'IBAN di "${v.nome}" dalla rubrica?`)) save(rimuoviVoce(v), "Eliminato dalla rubrica");
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <form
          className="rubrica-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nome.trim() || !iban.trim()) return;
            save(aggiungiVoce(nome, iban), "IBAN salvato in rubrica");
            setNome("");
            setIban("");
          }}
        >
          <span className="field-label">Aggiungi alla rubrica</span>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (es. CEKKO, Sala prove)" />
          <input className="input" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN" autoCapitalize="characters" />
          <button className="btn primary" type="submit" disabled={!nome.trim() || !iban.trim()}>
            Salva in rubrica
          </button>
        </form>
      </div>
    </details>
  );
}
