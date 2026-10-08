import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../lib/hooks";
import type { Lead } from "../lib/types";
import { PrioBadge } from "../components/Badges";
import { Segmented } from "../components/Segmented";
import { useSave } from "../components/Toast";
import { aggiungiLead, giaPresenti, parseLista, PRIORITA_OK, vuoto, type Candidato } from "../lib/nuoviLead";
import { copiaTesto } from "../lib/iban";

const REGIONI = [
  "Piemonte", "Valle d'Aosta", "Liguria", "Lombardia", "Veneto", "Trentino-Alto Adige", "Friuli-Venezia Giulia",
  "Emilia-Romagna", "Toscana", "Marche", "Umbria", "Lazio", "Abruzzo", "Molise", "Campania", "Puglia",
  "Basilicata", "Calabria", "Sicilia", "Sardegna",
];
const LUOGHI: Record<string, string> = {
  "Locali / live club": '"musica dal vivo" locale',
  Festival: "festival",
  "Sagre / feste patronali": 'sagra OR "festa patronale"',
  "Rassegne comunali / piazze": 'rassegna concerti piazza',
  "Agenzie di booking": '"agenzia" booking band',
};
const ARTISTI: Record<string, string> = {
  Tributi: '"tribute band" OR tributo',
  "Cover band": '"cover band"',
  Inediti: '"band emergenti" OR "musica originale"',
};
const SCHEDE = ["🔎 Ricerca guidata", "🔗 Da link", "📋 Importa lista"] as const;
type Scheda = (typeof SCHEDE)[number];

export default function Ricerca() {
  const { data: leads } = useCollection<Lead>("leads");
  const [scheda, setScheda] = useState<Scheda>(SCHEDE[0]);
  const [regione, setRegione] = useState("Piemonte");

  return (
    <div className="page">
      <header className="page-head">
        <Link to="/locali" className="link-btn">
          ← Locali
        </Link>
        <h1>Trova locali</h1>
        <p className="muted">Cerca nuovi locali ed eventi e aggiungili ai lead, gratis</p>
      </header>

      <Segmented options={SCHEDE} value={scheda} onChange={setScheda} />

      {scheda === SCHEDE[0] && <RicercaGuidata regione={regione} setRegione={setRegione} onVaiLink={() => setScheda(SCHEDE[1])} />}
      {scheda === SCHEDE[1] && <DaLink leads={leads} regione={regione} />}
      {scheda === SCHEDE[2] && <ImportaLista leads={leads} />}
    </div>
  );
}

/* ---------- 1. Ricerca guidata ---------- */

function RicercaGuidata({ regione, setRegione, onVaiLink }: { regione: string; setRegione: (r: string) => void; onVaiLink: () => void }) {
  const save = useSave();
  const [provincia, setProvincia] = useState("");
  const [luoghi, setLuoghi] = useState<string[]>([]);
  const [tipologia, setTipologia] = useState<string[]>(["Tributi", "Cover band"]);
  const [generi, setGeneri] = useState("");
  const [artisti, setArtisti] = useState("");
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const ricerche = useMemo(() => {
    const zona = provincia.trim() || regione || "Italia";
    const or = (xs: string[]) => (xs.length > 1 ? `(${xs.join(" OR ")})` : xs[0] ?? "");
    const l = or(luoghi.map((x) => LUOGHI[x]));
    const t = or(tipologia.map((x) => ARTISTI[x])) || '"tribute band" OR "cover band"';
    const nomi = artisti.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const out: { titolo: string; q: string }[] = [
      { titolo: "Locali ed eventi con tributi/cover in zona", q: `${l} ${t} ${zona} 2026`.trim() },
      { titolo: "Programmi e cartelloni estivi", q: `${l || "concerti"} ${zona} programma estate 2026 ${generi}`.trim() },
      { titolo: "Eventi su Facebook", q: `site:facebook.com/events ${t} ${zona}` },
      { titolo: "Contatti del direttore artistico", q: `${l || "locale musica dal vivo"} ${zona} "direttore artistico" OR "booking" OR "contatti"` },
    ];
    for (const n of nomi.slice(0, 3))
      out.push({ titolo: `Chi ha ospitato tributi a ${n}`, q: `("tributo a ${n}" OR "${n} tribute band" OR "tributo ${n}") ${zona}` });
    if (generi.trim()) out.push({ titolo: `Serate ${generi}`, q: `${generi} ${t} ${zona} serata live` });
    return out;
  }, [provincia, regione, luoghi, tipologia, generi, artisti]);

  const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=it&gl=it`;

  return (
    <>
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
          {Object.keys(LUOGHI).map((x) => (
            <button key={x} type="button" className={`chip ${luoghi.includes(x) ? "on" : ""}`} onClick={() => toggle(luoghi, x, setLuoghi)}>
              {x}
            </button>
          ))}
        </div>
        <span className="field-label">Hanno ospitato</span>
        <div className="chips-wrap">
          {Object.keys(ARTISTI).map((x) => (
            <button key={x} type="button" className={`chip ${tipologia.includes(x) ? "on" : ""}`} onClick={() => toggle(tipologia, x, setTipologia)}>
              {x}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">Generi musicali</span>
          <input className="input" value={generi} onChange={(e) => setGeneri(e.target.value)} placeholder="Es. rock italiano, elettronica, anni 90" />
        </label>
        <label className="field">
          <span className="field-label">Band / artisti tributati o coverizzati</span>
          <input className="input" value={artisti} onChange={(e) => setArtisti(e.target.value)} placeholder="Es. Subsonica, Bluvertigo, Litfiba" />
        </label>
      </section>

      <h2 className="section-title">Ricerche pronte</h2>
      <div className="list">
        {ricerche.map((r) => (
          <article key={r.titolo} className="card query-card">
            <strong>{r.titolo}</strong>
            <code className="query-text selectable">{r.q}</code>
            <div className="row">
              <a className="btn primary sm" href={google(r.q)} target="_blank" rel="noreferrer">
                Cerca su Google ↗
              </a>
              <button className="btn ghost sm" onClick={() => save(copiaTesto(r.q), "Ricerca copiata")}>
                Copia
              </button>
            </div>
          </article>
        ))}
      </div>
      <button className="btn ghost block" onClick={onVaiLink}>
        Trovato un locale? Incolla il link → 🔗 Da link
      </button>
    </>
  );
}

/* ---------- 2. Da link (estrazione contatti) ---------- */

interface Estratto {
  fonte: string;
  titolo?: string;
  descrizione?: string;
  sito?: string;
  emails?: string[];
  telefoni?: string[];
  social?: string[];
  errore?: string;
}

function DaLink({ leads, regione }: { leads: Lead[]; regione: string }) {
  const save = useSave();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [estratto, setEstratto] = useState<Estratto | null>(null);
  const [c, setC] = useState<Candidato>(() => ({ ...vuoto(), regione }));
  const set = <K extends keyof Candidato>(k: K, v: Candidato[K]) => setC((x) => ({ ...x, [k]: v }));

  const leggi = async () => {
    setBusy(true);
    setEstratto(null);
    try {
      const r = await fetch("/api/estrai-contatti", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const j = (await r.json()) as Estratto;
      setEstratto(j);
      setC((x) => ({
        ...x,
        fonte: j.fonte ?? url,
        nome: x.nome || (j.sito || j.titolo || "").split(/[|–—-]/)[0].trim(),
        email: j.emails?.[0] ?? x.email,
        telefono: j.telefoni?.[0] ?? x.telefono,
        social: j.social?.[0] ?? x.social,
        sito: x.sito || (j.fonte ? new URL(j.fonte).origin : ""),
        noteRicerca: x.noteRicerca || j.descrizione || "",
      }));
      if (!r.ok) save(Promise.reject(new Error(j.errore || `errore ${r.status}`)));
    } catch {
      save(Promise.reject(new Error("pagina non leggibile")));
    } finally {
      setBusy(false);
    }
  };

  const gia = c.nome && giaPresenti(leads)(c);

  return (
    <>
      <section className="card form-card">
        <label className="field">
          <span className="field-label">Link della pagina (sito del locale, evento, articolo…)</span>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
        </label>
        <button className="btn primary" disabled={!url.trim() || busy} onClick={leggi}>
          {busy ? "Leggo la pagina…" : "Leggi pagina ed estrai contatti"}
        </button>
        <p className="muted tiny">Facebook e Instagram non si lasciano leggere senza login: per quelli copia i contatti a mano.</p>
      </section>

      {estratto && !estratto.errore && (
        <section className="card estratto">
          <h3>Trovato nella pagina</h3>
          <Scelte titolo="Email" valori={estratto.emails} scelto={c.email} onScegli={(v) => set("email", v)} />
          <Scelte titolo="Telefoni" valori={estratto.telefoni} scelto={c.telefono} onScegli={(v) => set("telefono", v)} />
          <Scelte titolo="Social" valori={estratto.social} scelto={c.social} onScegli={(v) => set("social", v)} />
          {!estratto.emails?.length && !estratto.telefoni?.length && <p className="small warn-text">Nessun contatto trovato: cercalo sulla pagina e scrivilo sotto.</p>}
        </section>
      )}

      <section className="card form-card">
        <h3>{estratto ? "Controlla e aggiungi" : "Oppure compila a mano"}</h3>
        <FormCandidato c={c} set={set} />
        {gia && <p className="small warn-text">È già nella lista dei lead.</p>}
        <button
          className="btn primary block"
          disabled={!c.nome.trim() || !!gia}
          onClick={() => {
            const p = aggiungiLead([c], leads);
            save(p, "Lead aggiunto");
            p.then(() => {
              setC({ ...vuoto(), regione });
              setEstratto(null);
              setUrl("");
            });
          }}
        >
          + Aggiungi ai lead
        </button>
      </section>
    </>
  );
}

function Scelte({ titolo, valori, scelto, onScegli }: { titolo: string; valori?: string[]; scelto: string; onScegli: (v: string) => void }) {
  if (!valori?.length) return null;
  return (
    <div className="scelte">
      <span className="field-label">{titolo}</span>
      <div className="chips-wrap">
        {valori.map((v) => (
          <button key={v} type="button" className={`chip ${scelto === v ? "on" : ""}`} onClick={() => onScegli(scelto === v ? "" : v)}>
            {v.replace(/^https?:\/\/(www\.)?/, "")}
          </button>
        ))}
      </div>
    </div>
  );
}

function FormCandidato({ c, set }: { c: Candidato; set: <K extends keyof Candidato>(k: K, v: Candidato[K]) => void }) {
  const campo = (k: keyof Candidato, label: string, ph = "") => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="input" value={c[k] as string} onChange={(e) => set(k, e.target.value as never)} placeholder={ph} />
    </label>
  );
  return (
    <>
      {campo("nome", "Nome *", "Nome del locale / evento")}
      {campo("tipo", "Tipo", "Es. Sagra, Festival, Locale fisso, Agenzia")}
      <div className="row two">
        {campo("comune", "Comune")}
        {campo("provincia", "Provincia", "Es. CN")}
      </div>
      <div className="row two">
        {campo("regione", "Regione")}
        {campo("periodo", "Periodo", "Es. Luglio 2026")}
      </div>
      {campo("genere", "Generi / artisti ospitati", "Es. Tributi Vasco, 883")}
      <div className="row two">
        {campo("email", "Email")}
        {campo("telefono", "Telefono")}
      </div>
      {campo("referente", "Referente", "Nome del direttore artistico")}
      {campo("social", "Social")}
      {campo("fonte", "Fonte (link)")}
      <label className="field">
        <span className="field-label">Note</span>
        <textarea className="input" rows={2} value={c.noteRicerca} onChange={(e) => set("noteRicerca", e.target.value)} />
      </label>
      <span className="field-label">Priorità</span>
      <Segmented options={PRIORITA_OK} value={c.priorita} onChange={(v) => set("priorita", v)} />
    </>
  );
}

/* ---------- 3. Importa lista (preparata in chat con Claude) ---------- */

function ImportaLista({ leads }: { leads: Lead[] }) {
  const save = useSave();
  const [testo, setTesto] = useState("");
  const [lista, setLista] = useState<Candidato[] | null>(null);
  const [scelti, setScelti] = useState<Set<number>>(new Set());
  const gia = useMemo(() => giaPresenti(leads), [leads]);

  const leggi = () => {
    try {
      const l = parseLista(testo);
      setLista(l);
      setScelti(new Set(l.map((c, i) => (gia(c) ? -1 : i)).filter((i) => i >= 0)));
      if (!l.length) save(Promise.reject(new Error("Nessun locale trovato nel testo.")));
    } catch (e) {
      save(Promise.reject(new Error(e instanceof SyntaxError ? "Testo non valido: incolla tutto il blocco che ti ho preparato." : (e as Error).message)));
    }
  };

  return (
    <>
      <section className="card form-card">
        <p className="small">
          Chiedi a Claude in chat una ricerca (es. "sagre in provincia di Cuneo che fanno tributi"): ti preparerà un blocco di testo. Incollalo
          qui.
        </p>
        <textarea className="input" rows={6} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder='[{"nome": "…", "comune": "…", …}]' />
        <button className="btn primary" disabled={!testo.trim()} onClick={leggi}>
          Leggi elenco
        </button>
      </section>

      {lista && lista.length > 0 && (
        <>
          <h2 className="section-title">Da importare ({lista.length})</h2>
          <div className="list">
            {lista.map((r, i) => (
              <CardCandidato
                key={i}
                r={r}
                gia={gia(r)}
                on={scelti.has(i)}
                onToggle={() =>
                  setScelti((s) => {
                    const n = new Set(s);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
              />
            ))}
          </div>
          <div className="azioni-scaletta">
            <button
              className="btn primary"
              disabled={scelti.size === 0}
              onClick={() => {
                const p = aggiungiLead([...scelti].map((i) => lista[i]), leads);
                save(p.then((n) => n), `${scelti.size} lead aggiunti`);
                p.then(() => setScelti(new Set()));
              }}
            >
              + Aggiungi {scelti.size || ""} ai lead
            </button>
          </div>
        </>
      )}
    </>
  );
}

function CardCandidato({ r, gia, on, onToggle }: { r: Candidato; gia: boolean; on: boolean; onToggle: () => void }) {
  const link = (u: string) => (/^https?:/.test(u) ? u : `https://${u}`);
  return (
    <article className={`card ris-card ${on ? "on" : ""} ${gia ? "gia" : ""}`}>
      <label className="ris-head">
        <input type="checkbox" disabled={gia} checked={on} onChange={onToggle} />
        <span className="grow">
          <strong>{r.nome}</strong>
          <span className="muted small">
            {" "}
            · {r.comune}
            {r.provincia ? ` (${r.provincia})` : ""}
            {r.regione ? `, ${r.regione}` : ""}
          </span>
        </span>
        {gia ? <span className="badge st-done">✓ nei lead</span> : <PrioBadge p={r.priorita} />}
      </label>
      {(r.tipo || r.periodo) && (
        <p className="small">
          <strong>{r.tipo}</strong>
          {r.periodo ? ` · ${r.periodo}` : ""}
        </p>
      )}
      {(r.genere || r.tipologiaArtisti) && <p className="small muted">🎵 {[r.genere, r.tipologiaArtisti].filter(Boolean).join(" · ")}</p>}
      {r.noteRicerca && <p className="small">{r.noteRicerca}</p>}
      <div className="ris-contatti small">
        {r.referente && <span>👤 {r.referente}</span>}
        {r.email && <a href={`mailto:${r.email}`}>✉️ {r.email}</a>}
        {r.telefono && <a href={`tel:${r.telefono.replace(/[^\d+]/g, "")}`}>📞 {r.telefono}</a>}
        {r.social && (
          <a href={link(r.social)} target="_blank" rel="noreferrer">
            🌐 social
          </a>
        )}
        {r.sito && (
          <a href={link(r.sito)} target="_blank" rel="noreferrer">
            🔗 sito
          </a>
        )}
        {!r.email && !r.telefono && !r.social && <span className="muted">contatti da reperire</span>}
      </div>
      {r.fonte && (
        <a className="ext tiny" href={link(r.fonte)} target="_blank" rel="noreferrer">
          Fonte: {r.fonte.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)} ↗
        </a>
      )}
    </article>
  );
}
