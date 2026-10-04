import { useEffect, useMemo, useRef, useState } from "react";
import { arrayRemove, arrayUnion, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/hooks";
import type { NuovoPezzo, RigaScaletta, ScalettaDoc } from "../lib/types";
import { usePartecipanti } from "./Spese";
import { useSave } from "../components/Toast";
import { tick } from "../lib/haptics";
import { dataIt } from "../lib/format";
import { ErrorBox, Loading } from "../components/States";
import scalettaSeed from "../../data/scaletta.json";

const LIVE = "live";

export const COLORI_RIGA: { key: string; nome: string; hex: string }[] = [
  { key: "", nome: "Nessuno", hex: "transparent" },
  { key: "rosso", nome: "Rosso", hex: "#ff4d6d" },
  { key: "arancio", nome: "Arancio", hex: "#ff8c3a" },
  { key: "giallo", nome: "Giallo", hex: "#ffd23f" },
  { key: "verde", nome: "Verde", hex: "#3ddc84" },
  { key: "ciano", nome: "Ciano", hex: "#22e4ff" },
  { key: "blu", nome: "Blu", hex: "#4f7cff" },
  { key: "viola", nome: "Viola", hex: "#a66bff" },
  { key: "rosa", nome: "Rosa", hex: "#ff4fc3" },
];
const hexOf = (k: string) => COLORI_RIGA.find((c) => c.key === k)?.hex ?? "transparent";

const newId = () => Math.random().toString(36).slice(2, 10);

const seedRighe = (): RigaScaletta[] =>
  scalettaSeed.righe.map((r) => ({ id: newId(), tipo: r.tipo as RigaScaletta["tipo"], titolo: r.titolo, colore: "" }));

/** Numerazione automatica dei brani; quelli dopo la sezione "ALTRE" non sono numerati. */
function numerazione(righe: RigaScaletta[]) {
  const out: Record<string, number | null> = {};
  let n = 0;
  let stop = false;
  for (const r of righe) {
    if (r.tipo === "sezione") {
      if (/^altr/i.test(r.titolo.trim())) stop = true;
      continue;
    }
    out[r.id] = stop ? null : ++n;
  }
  return out;
}

export default function Scaletta() {
  const { data: docs, loading, error } = useCollection<ScalettaDoc>("scalette");
  const { partecipanti } = usePartecipanti();
  const [tab, setTab] = useState<string>(() => {
    try {
      return sessionStorage.getItem("ondasonica.scalettaTab") ?? LIVE;
    } catch {
      return LIVE;
    }
  });
  const dirtyRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem("ondasonica.scalettaTab", tab);
    } catch {
      /* ignorato */
    }
  }, [tab]);

  const byId = useMemo(() => Object.fromEntries(docs.map((d) => [d.id, d])), [docs]);
  const live = byId[LIVE];

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;

  const cambiaTab = (t: string) => {
    if (t === tab) return;
    if (dirtyRef.current && !confirm("Hai modifiche non salvate a questa proposta. Uscire senza salvare?")) return;
    dirtyRef.current = false;
    tick(6);
    setTab(t);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Scaletta</h1>
      </header>

      <div className="chips sub-tabs" data-noswipe role="tablist">
        <button role="tab" aria-selected={tab === LIVE} className={`chip live-tab ${tab === LIVE ? "on" : ""}`} onClick={() => cambiaTab(LIVE)}>
          ● Scaletta ufficiale
        </button>
        {partecipanti.map((p) => (
          <button role="tab" aria-selected={tab === p} key={p} className={`chip ${tab === p ? "on" : ""}`} onClick={() => cambiaTab(p)}>
            Proposta {p}
          </button>
        ))}
      </div>

      {tab === LIVE || !partecipanti.includes(tab) ? (
        <LiveView live={live} docs={docs} />
      ) : (
        <PropostaView
          key={tab}
          membro={tab}
          mio={byId[tab]}
          live={live}
          onDirty={(d) => (dirtyRef.current = d)}
          onPromossa={() => {
            dirtyRef.current = false;
            setTab(LIVE);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- SCALETTA UFFICIALE ---------------- */

function LiveView({ live, docs }: { live?: ScalettaDoc; docs: ScalettaDoc[] }) {
  const save = useSave();
  const ref = doc(db(), "scalette", LIVE);

  if (!live?.righe)
    return (
      <div className="card">
        <p>La scaletta ufficiale non è ancora nel database.</p>
        <button
          className="btn primary"
          onClick={() => save(setDoc(ref, { righe: seedRighe(), aggiornato: new Date().toISOString(), origine: "" }, { merge: true }), "Scaletta caricata")}
        >
          Carica scaletta iniziale
        </button>
      </div>
    );

  const righe = live.righe;

  // Aggiunge il brano alla scaletta ufficiale e a tutte le proposte già salvate dei membri.
  const aggiungiOvunque = (titolo: string) => {
    const t = titolo.trim().toUpperCase();
    if (!t) return false;
    if (righe.some((r) => r.tipo === "brano" && r.titolo === t) && !confirm(`"${t}" è già in scaletta. Aggiungerlo comunque?`)) return false;
    const riga: RigaScaletta = { id: newId(), tipo: "brano", titolo: t, colore: "" };
    const now = new Date().toISOString();
    const b = writeBatch(db());
    b.update(ref, { righe: inserisciNeiBis(righe, riga), aggiornato: now });
    for (const d of docs) {
      if (d.id === LIVE || !d.righe) continue; // chi non ha salvato una proposta parte comunque dalla ufficiale
      b.update(doc(db(), "scalette", d.id), { righe: inserisciNeiBis(d.righe, riga) });
    }
    save(b.commit(), `${t} aggiunto a tutte le scalette`);
    return true;
  };

  const proposte = docs
    .filter((d) => d.id !== LIVE)
    .flatMap((d) => (d.nuoviPezzi ?? []).map((p) => ({ ...p, membro: d.id })))
    .sort((a, b) => a.creato.localeCompare(b.creato));

  return (
    <>
      <p className="muted small">
        {numBrani(righe)} brani
        {live.aggiornato ? ` · aggiornata il ${dataIt(live.aggiornato)}` : ""}
        {live.origine ? ` · dalla proposta di ${live.origine}` : ""}
      </p>
      <AggiungiBranoUfficiale onAdd={aggiungiOvunque} />
      <ListaScaletta
        righe={righe}
        editable={false}
        onColore={(id, colore) =>
          save(updateDoc(ref, { righe: righe.map((r) => (r.id === id ? { ...r, colore } : r)) }), "Colore salvato")
        }
      />

      <section className="card proposte-box">
        <h3>💡 Proposte nuovi pezzi</h3>
        {proposte.length === 0 ? (
          <p className="muted small">Nessuna proposta. Ognuno può aggiungerle dalla propria tab.</p>
        ) : (
          <ul className="proposte-list">
            {proposte.map((p) => (
              <li key={p.membro + p.id}>
                <span className="pz-titolo">{p.titolo}</span> <span className="muted">proposta da</span>{" "}
                <span className="pz-chi">{p.membro}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted tiny">Sola lettura · si aggiorna da solo con le proposte scritte nelle tab personali.</p>
      </section>
    </>
  );
}

/** Inserisce la riga come ultimo brano del blocco BIS (o in fondo se non c'è un BIS). */
export function inserisciNeiBis(righe: RigaScaletta[], riga: RigaScaletta): RigaScaletta[] {
  const bis = righe.findIndex((r) => r.tipo === "sezione" && /^bis/i.test(r.titolo.trim()));
  if (bis < 0) return [...righe, riga];
  let j = bis + 1;
  while (j < righe.length && righe[j].tipo === "brano") j++;
  return [...righe.slice(0, j), riga, ...righe.slice(j)];
}

const numBrani = (r: RigaScaletta[]) => Object.values(numerazione(r)).filter((n) => n !== null).length;

/* ---------------- PROPOSTA PERSONALE ---------------- */

function PropostaView({
  membro,
  mio,
  live,
  onDirty,
  onPromossa,
}: {
  membro: string;
  mio?: ScalettaDoc;
  live?: ScalettaDoc;
  onDirty: (d: boolean) => void;
  onPromossa: () => void;
}) {
  const save = useSave();
  const remote = mio?.righe ?? live?.righe ?? [];
  const [draft, setDraft] = useState<RigaScaletta[]>(remote);
  const [dirty, setDirtyState] = useState(false);
  const setDirty = (d: boolean) => {
    setDirtyState(d);
    onDirty(d);
  };

  // Se nessuno sta modificando, si riallinea alle modifiche arrivate da altri telefoni.
  // Se invece ci sono modifiche in corso, aggiunge comunque i brani nuovi arrivati
  // (es. "+ Aggiungi brano" dalla scaletta ufficiale) senza perdere il lavoro locale.
  const remoteKey = JSON.stringify(remote);
  const prevRemote = useRef(remote);
  useEffect(() => {
    const prevIds = new Set(prevRemote.current.map((r) => r.id));
    prevRemote.current = remote;
    if (!dirty) return setDraft(remote);
    const nuovi = remote.filter((r) => !prevIds.has(r.id));
    if (nuovi.length) setDraft((d) => nuovi.reduce((acc, r) => (acc.some((x) => x.id === r.id) ? acc : inserisciNeiBis(acc, r)), d));
  }, [remoteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: RigaScaletta[]) => {
    setDraft(next);
    setDirty(true);
  };

  const ref = doc(db(), "scalette", membro);

  const salva = () => {
    save(setDoc(ref, { righe: draft, aggiornato: new Date().toISOString() }, { merge: true }), "Proposta salvata");
    setDirty(false);
  };

  const rendiLive = () => {
    if (!confirm(`Sostituire la SCALETTA UFFICIALE con la proposta di ${membro}?`)) return;
    const now = new Date().toISOString();
    const b = writeBatch(db());
    b.set(ref, { righe: draft, aggiornato: now }, { merge: true });
    b.set(doc(db(), "scalette", LIVE), { righe: draft, aggiornato: now, origine: membro }, { merge: true });
    save(b.commit(), "Ora è la scaletta ufficiale ✓");
    tick([15, 40, 15]);
    onPromossa();
  };

  return (
    <>
      <p className="muted small">
        {!mio?.righe
          ? "Partenza: copia della scaletta ufficiale. Trascina ⠿ per riordinare, poi SALVA."
          : `Salvata il ${dataIt(mio.aggiornato)} · trascina ⠿ per riordinare`}
      </p>

      <ListaScaletta
        righe={draft}
        editable
        onChange={update}
        onColore={(id, colore) => update(draft.map((r) => (r.id === id ? { ...r, colore } : r)))}
      />

      <AggiungiRiga onAdd={(r) => update([...draft, r])} />

      <div className={`azioni-scaletta ${dirty ? "dirty" : ""}`}>
        {dirty && <p className="small warn-text">● Modifiche non salvate</p>}
        <div className="row two">
          <button className="btn primary" onClick={salva} disabled={!dirty}>
            Salva
          </button>
          <button className="btn live-btn" onClick={rendiLive} disabled={draft.length === 0}>
            Rendi scaletta ufficiale
          </button>
        </div>
      </div>

      <NuoviPezzi membro={membro} pezzi={mio?.nuoviPezzi ?? []} />
    </>
  );
}

function AggiungiBranoUfficiale({ onAdd }: { onAdd: (titolo: string) => boolean }) {
  const [aperto, setAperto] = useState(false);
  const [titolo, setTitolo] = useState("");
  if (!aperto)
    return (
      <button className="btn primary block" onClick={() => setAperto(true)}>
        + Aggiungi brano
      </button>
    );
  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (onAdd(titolo)) {
          setTitolo("");
          setAperto(false);
        }
      }}
    >
      <label className="field">
        <span className="field-label">Nuovo brano</span>
        <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo" autoFocus />
      </label>
      <p className="muted small">Viene aggiunto come ultimo dei BIS, nella scaletta ufficiale e in tutte le proposte dei membri.</p>
      <div className="row end">
        <button type="button" className="btn ghost" onClick={() => setAperto(false)}>
          Annulla
        </button>
        <button type="submit" className="btn primary" disabled={!titolo.trim()}>
          Aggiungi a tutte
        </button>
      </div>
    </form>
  );
}

function AggiungiRiga({ onAdd }: { onAdd: (r: RigaScaletta) => void }) {
  const [titolo, setTitolo] = useState("");
  return (
    <form
      className="add-riga"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titolo.trim()) return;
        onAdd({ id: newId(), tipo: "brano", titolo: titolo.trim().toUpperCase(), colore: "" });
        setTitolo("");
      }}
    >
      <input className="input" placeholder="Aggiungi brano…" value={titolo} onChange={(e) => setTitolo(e.target.value)} />
      <button className="btn ghost" type="submit" disabled={!titolo.trim()}>
        +
      </button>
      <button
        className="btn ghost"
        type="button"
        title="Aggiungi uno stacco / intestazione"
        onClick={() => onAdd({ id: newId(), tipo: "sezione", titolo: "", colore: "" })}
      >
        + Stacco
      </button>
    </form>
  );
}

function NuoviPezzi({ membro, pezzi }: { membro: string; pezzi: NuovoPezzo[] }) {
  const save = useSave();
  const [titolo, setTitolo] = useState("");
  const ref = doc(db(), "scalette", membro);

  return (
    <section className="card proposte-box">
      <h3>💡 Proposte nuovi pezzi di {membro}</h3>
      <form
        className="add-riga"
        onSubmit={(e) => {
          e.preventDefault();
          const t = titolo.trim();
          if (!t) return;
          const p: NuovoPezzo = { id: newId(), titolo: t, creato: new Date().toISOString() };
          save(setDoc(ref, { nuoviPezzi: arrayUnion(p) }, { merge: true }), "Proposta salvata");
          setTitolo("");
        }}
      >
        <input className="input" placeholder="Titolo del pezzo da proporre…" value={titolo} onChange={(e) => setTitolo(e.target.value)} />
        <button className="btn primary" type="submit" disabled={!titolo.trim()}>
          Salva
        </button>
      </form>
      {pezzi.length > 0 && (
        <ul className="proposte-list editable">
          {pezzi.map((p) => (
            <li key={p.id}>
              <span className="pz-titolo grow">{p.titolo}</span>
              <button
                className="icon-btn"
                aria-label={`Rimuovi ${p.titolo}`}
                onClick={() => {
                  if (confirm(`Rimuovere la proposta "${p.titolo}"?`)) save(updateDoc(ref, { nuoviPezzi: arrayRemove(p) }), "Rimossa");
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted tiny">Compare automaticamente sotto la SCALETTA UFFICIALE come “titolo proposta da {membro}”.</p>
    </section>
  );
}

/* ---------------- LISTA (con drag & drop) ---------------- */

function ListaScaletta({
  righe,
  editable,
  onChange,
  onColore,
}: {
  righe: RigaScaletta[];
  editable: boolean;
  onChange?: (r: RigaScaletta[]) => void;
  onColore: (id: string, colore: string) => void;
}) {
  const numeri = numerazione(righe);
  const listRef = useRef<HTMLOListElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const lastY = useRef(0);
  const righeRef = useRef(righe);
  righeRef.current = righe;

  // Sposta la riga trascinata sotto il dito.
  const riposiziona = (id: string) => {
    const els = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? []);
    const from = righeRef.current.findIndex((r) => r.id === id);
    let to = from;
    for (let i = 0; i < els.length; i++) {
      const rc = els[i].getBoundingClientRect();
      if (lastY.current >= rc.top && lastY.current <= rc.bottom) {
        to = i;
        break;
      }
    }
    if (to !== from && to >= 0) {
      const next = [...righeRef.current];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      righeRef.current = next;
      onChange?.(next);
      tick(5);
    }
  };

  // Scroll automatico quando si trascina vicino ai bordi dello schermo.
  useEffect(() => {
    if (!dragId) return;
    const t = window.setInterval(() => {
      const y = lastY.current;
      const bottomLimit = window.innerHeight - 150;
      if (y < 90) window.scrollBy(0, -10);
      else if (y > bottomLimit) window.scrollBy(0, 10);
      else return;
      riposiziona(dragId);
    }, 16);
    return () => window.clearInterval(t);
  }, [dragId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ol className={`scaletta ${dragId ? "dragging-list" : ""}`} ref={listRef} data-noswipe>
      {righe.map((r) => {
        const hex = hexOf(r.colore);
        const style = r.colore ? ({ ["--rc" as string]: hex } as React.CSSProperties) : undefined;
        const isDrag = dragId === r.id;
        return (
          <li
            key={r.id}
            data-row
            className={`riga riga-${r.tipo} ${r.colore ? "colorata" : ""} ${isDrag ? "drag" : ""} ${r.tipo === "sezione" && !r.titolo ? "stacco" : ""}`}
            style={style}
          >
            {editable && (
              <span
                className="handle"
                aria-label="Trascina per spostare"
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  lastY.current = e.clientY;
                  setPaletteId(null);
                  setDragId(r.id);
                  tick(10);
                }}
                onPointerMove={(e) => {
                  if (dragId !== r.id) return;
                  lastY.current = e.clientY;
                  riposiziona(r.id);
                }}
                onPointerUp={() => setDragId(null)}
                onPointerCancel={() => setDragId(null)}
              >
                ⠿
              </span>
            )}

            {r.tipo === "brano" ? (
              <>
                <button className="num" onClick={() => setPaletteId(paletteId === r.id ? null : r.id)} aria-label="Scegli colore">
                  {numeri[r.id] ?? "•"}
                </button>
                <span className="titolo">{r.titolo}</span>
              </>
            ) : editable ? (
              <input
                className="sezione-input"
                value={r.titolo}
                placeholder="— stacco —"
                onChange={(e) => onChange?.(righe.map((x) => (x.id === r.id ? { ...x, titolo: e.target.value.toUpperCase() } : x)))}
              />
            ) : (
              <span className="sezione-label">{r.titolo || ""}</span>
            )}

            {r.tipo === "sezione" && r.titolo && (
              <button className="num mini" onClick={() => setPaletteId(paletteId === r.id ? null : r.id)} aria-label="Scegli colore">
                🎨
              </button>
            )}

            {editable && (
              <button
                className="del"
                aria-label="Rimuovi riga"
                onClick={() => {
                  if (r.tipo === "sezione" || confirm(`Togliere "${r.titolo}" da questa proposta?`))
                    onChange?.(righe.filter((x) => x.id !== r.id));
                }}
              >
                ✕
              </button>
            )}

            {paletteId === r.id && (
              <div className="palette" role="listbox" aria-label="Colore riga">
                {COLORI_RIGA.map((c) => (
                  <button
                    key={c.key || "none"}
                    className={`swatch ${c.key === r.colore ? "on" : ""} ${c.key ? "" : "none"}`}
                    style={{ ["--sw" as string]: c.hex } as React.CSSProperties}
                    title={c.nome}
                    aria-label={c.nome}
                    onClick={() => {
                      onColore(r.id, c.key);
                      setPaletteId(null);
                      tick();
                    }}
                  />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
