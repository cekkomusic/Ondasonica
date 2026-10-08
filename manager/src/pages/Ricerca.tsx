import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection, useDocument } from "../lib/hooks";
import type { Lead, Priorita } from "../lib/types";
import { PrioBadge } from "../components/Badges";
import { useSave } from "../components/Toast";
import { norm } from "../lib/format";

const REGIONI = [
  "Piemonte", "Valle d'Aosta", "Liguria", "Lombardia", "Veneto", "Trentino-Alto Adige", "Friuli-Venezia Giulia",
  "Emilia-Romagna", "Toscana", "Marche", "Umbria", "Lazio", "Abruzzo", "Molise", "Campania", "Puglia",
  "Basilicata", "Calabria", "Sicilia", "Sardegna",
];
const LUOGHI = ["Locali / live club", "Festival", "Sagre / feste patronali", "Rassegne comunali / piazze", "Agenzie di booking"];
const ARTISTI = ["Tributi", "Cover band", "Inediti"];

interface Risultato {
  nome: string; tipo: string; comune: string; provincia: string; regione: string; periodo: string; genere: string;
  tipologiaArtisti: string; email: string; telefono: string; sito: string; social: string; referente: string;
  noteRicerca: string; fonte: string; priorita: Priorita;
}
interface StatoRicerca {
  stato?: "in_corso" | "completata" | "errore";
  risultati?: Risultato[];
  nota?: string;
  errore?: string;
  iniziata?: string;
  completata?: string;
}

const chiave = (s: string) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();

export default function Ricerca() {
  const save = useSave();
  const { data: leads } = useCollection<Lead>("leads");
  const ultima = useDocument<StatoRicerca>("config", "ricercaLocali").data;
  const [regione, setRegione] = useState("Piemonte");
  const [provincia, setProvincia] = useState("");
  const [luoghi, setLuoghi] = useState<string[]>([]);
  const [tipologia, setTipologia] = useState<string[]>(["Tributi", "Cover band"]);
  const [generi, setGeneri] = useState("");
  const [artisti, setArtisti] = useState("");
  const [altro, setAltro] = useState("");
  const [quanti, setQuanti] = useState(12);
  const [attesa, setAttesa] = useState(false);
  const [scelti, setScelti] = useState<Set<number>>(new Set());

  const nomiLead = useMemo(() => new Set(leads.map((l) => chiave(l.nome))), [leads]);
  const risultati = ultima?.stato === "completata" ? (ultima.risultati ?? []) : [];
  const inCorso = attesa || (ultima?.stato === "in_corso" && Date.now() - Date.parse(ultima.iniziata ?? "") < 6 * 60_000);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const cerca = async () => {
    setAttesa(true);
    setScelti(new Set());
    try {
      const r = await fetch("/api/cerca-locali", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regione, provincia, tipiLuogo: luoghi, tipologiaArtisti: tipologia, generi, artisti, altro, quanti }),
      });
      const j = (await r.json().catch(() => ({}))) as { errore?: string; risultati?: unknown[] };
      if (!r.ok) throw new Error(j.errore || `errore ${r.status}`);
      save(Promise.resolve(), `${j.risultati?.length ?? 0} risultati trovati`);
    } catch (e) {
      save(Promise.reject(e instanceof Error ? e : new Error("ricerca non riuscita")));
    } finally {
      setAttesa(false);
    }
  };

  const aggiungi = () => {
    const ordineMax = leads.reduce((m, l) => Math.max(m, l.ordine ?? 0), 0);
    const nuovi = [...scelti].map((i) => risultati[i]).filter((r) => r && !nomiLead.has(chiave(r.nome)));
    const scritture = nuovi.map((r, k) => {
      const id = `${chiave(r.nome).replace(/ /g, "-").slice(0, 50)}-${Date.now().toString(36)}${k}`;
      const contatto = [r.referente && `Ref. ${r.referente}`, r.email, r.telefono, r.social, r.sito].filter(Boolean).join(" | ");
      const lead: Lead & { origine: string } = {
        id,
        ordine: ordineMax + k + 1,
        priorita: r.priorita,
        nome: r.nome,
        tipo: r.tipo,
        comune: r.provincia ? `${r.comune} (${r.provincia})` : r.comune,
        regione: r.regione,
        periodo2026: r.periodo,
        genere: [r.genere, r.tipologiaArtisti].filter(Boolean).join(" · "),
        contatto: contatto || "contatti da reperire",
        noteRicerca: r.noteRicerca,
        fonte: r.fonte,
        statoContatto: "Da contattare",
        notaUtente: "",
        dataUltimoContatto: null,
        origine: "ricerca AI",
      };
      return setDoc(doc(db(), "leads", id), lead);
    });
    save(Promise.all(scritture), nuovi.length === 1 ? "1 lead aggiunto" : `${nuovi.length} lead aggiunti`);
    setScelti(new Set());
  };

  return (
    <div className="page">
      <header className="page-head">
        <Link to="/locali" className="link-btn">
          ← Locali
        </Link>
        <h1>Trova locali</h1>
        <p className="muted">Ricerca sul web con l'AI: locali, festival, sagre e rassegne con i contatti</p>
      </header>

      <section className="card form-card">
        <div className="row two">
          <label className="field">
            <span className="field-label">Regione</span>
            <select className="input" value={regione} onChange={(e) => setRegione(e.target.value)}>
              <option value="">Tutta Italia</option>
              {REGIONI.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Provincia / zona</span>
            <input className="input" value={provincia} onChange={(e) => setProvincia(e.target.value)} placeholder="Es. Cuneo, Canavese" />
          </label>
        </div>
        <span className="field-label">Tipo di luogo</span>
        <div className="chips-wrap">
          {LUOGHI.map((l) => (
            <button key={l} type="button" className={`chip ${luoghi.includes(l) ? "on" : ""}`} onClick={() => toggle(luoghi, l, setLuoghi)}>
              {l}
            </button>
          ))}
        </div>
        <span className="field-label">Hanno ospitato</span>
        <div className="chips-wrap">
          {ARTISTI.map((a) => (
            <button key={a} type="button" className={`chip ${tipologia.includes(a) ? "on" : ""}`} onClick={() => toggle(tipologia, a, setTipologia)}>
              {a}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">Generi musicali</span>
          <input className="input" value={generi} onChange={(e) => setGeneri(e.target.value)} placeholder="Es. rock italiano, elettronica, anni 90" />
        </label>
        <label className="field">
          <span className="field-label">Band / artisti tributati o coverizzati</span>
          <input className="input" value={artisti} onChange={(e) => setArtisti(e.target.value)} placeholder="Es. Subsonica, Bluvertigo, Litfiba, Marlene Kuntz" />
        </label>
        <label className="field">
          <span className="field-label">Altro (facoltativo)</span>
          <input className="input" value={altro} onChange={(e) => setAltro(e.target.value)} placeholder="Es. solo estate 2027, con palco all'aperto" />
        </label>
        <label className="field">
          <span className="field-label">Quanti risultati: {quanti}</span>
          <input type="range" min={5} max={25} step={1} value={quanti} onChange={(e) => setQuanti(Number(e.target.value))} />
        </label>
        <button className="btn primary block" disabled={inCorso} onClick={cerca}>
          {inCorso ? "Ricerca in corso…" : "🔎 Cerca"}
        </button>
        {inCorso && (
          <p className="hint-box small">
            ⏳ L'AI sta cercando e leggendo le pagine: di solito servono 1–3 minuti. Puoi lasciare la pagina, i risultati arriveranno qui per tutta la
            band.
          </p>
        )}
      </section>

      {ultima?.stato === "errore" && !inCorso && <p className="card error-box small">⚠️ {ultima.errore}</p>}

      {risultati.length > 0 && (
        <>
          <div className="row between">
            <h2 className="section-title">
              Risultati ({risultati.length}){ultima?.completata ? ` · ${new Date(ultima.completata).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}` : ""}
            </h2>
          </div>
          {ultima?.nota && <p className="muted small">{ultima.nota}</p>}
          <div className="list ricerca-list">
            {risultati.map((r, i) => {
              const gia = nomiLead.has(chiave(r.nome));
              const on = scelti.has(i);
              return (
                <article key={i} className={`card ris-card ${on ? "on" : ""} ${gia ? "gia" : ""}`}>
                  <label className="ris-head">
                    <input
                      type="checkbox"
                      disabled={gia}
                      checked={on}
                      onChange={() => setScelti((s) => {
                        const n = new Set(s);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })}
                    />
                    <span className="grow">
                      <strong>{r.nome}</strong>
                      <span className="muted small"> · {r.comune}{r.provincia ? ` (${r.provincia})` : ""}, {r.regione}</span>
                    </span>
                    {gia ? <span className="badge st-done">✓ nei lead</span> : <PrioBadge p={r.priorita} />}
                  </label>
                  <p className="small">
                    <strong>{r.tipo}</strong>
                    {r.periodo ? ` · ${r.periodo}` : ""}
                  </p>
                  {(r.genere || r.tipologiaArtisti) && <p className="small muted">🎵 {[r.genere, r.tipologiaArtisti].filter(Boolean).join(" · ")}</p>}
                  {r.noteRicerca && <p className="small">{r.noteRicerca}</p>}
                  <div className="ris-contatti small">
                    {r.referente && <span>👤 {r.referente}</span>}
                    {r.email && <a href={`mailto:${r.email}`}>✉️ {r.email}</a>}
                    {r.telefono && <a href={`tel:${r.telefono.replace(/[^\d+]/g, "")}`}>📞 {r.telefono}</a>}
                    {r.social && <a href={/^https?:/.test(r.social) ? r.social : `https://${r.social}`} target="_blank" rel="noreferrer">🌐 social</a>}
                    {r.sito && <a href={/^https?:/.test(r.sito) ? r.sito : `https://${r.sito}`} target="_blank" rel="noreferrer">🔗 sito</a>}
                    {!r.email && !r.telefono && !r.social && <span className="muted">contatti da reperire</span>}
                  </div>
                  {r.fonte && (
                    <a className="ext tiny" href={r.fonte} target="_blank" rel="noreferrer">
                      Fonte: {r.fonte.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)} ↗
                    </a>
                  )}
                </article>
              );
            })}
          </div>
          <div className="azioni-scaletta">
            <button className="btn primary" disabled={scelti.size === 0} onClick={aggiungi}>
              + Aggiungi {scelti.size || ""} ai lead
            </button>
          </div>
          <p className="muted tiny">Controlla sempre i contatti sulla fonte prima di scrivere: l'AI può sbagliare.</p>
        </>
      )}
    </div>
  );
}
