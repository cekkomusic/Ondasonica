import { useEffect, useMemo, useState } from "react";
import { useCollection, useDocument } from "../lib/hooks";
import type { DataPresa } from "../lib/types";
import { usePartecipanti } from "./Spese";
import { useSave } from "../components/Toast";
import { ErrorBox, Loading } from "../components/States";
import {
  aggiungiEventoBand,
  BAND,
  eventiBand,
  isoDay,
  meseId,
  rimuoviEventoBand,
  salvaImpegno,
  TIPI_EVENTO,
  type EventoBand,
  type Impegno,
  type MeseCalendario,
  type TipoEvento,
} from "../lib/calendario";
import { today } from "../lib/format";

const GIORNI = ["L", "M", "M", "G", "V", "S", "D"];

// Collaboratori che seguono video e audio live: presenti nel calendario ma non nelle spese.
const CREW = ["SILVANO", "MATTEO"];

const leggi = <T,>(k: string, def: T): T => {
  try {
    return (localStorage.getItem(k) as T) ?? def;
  } catch {
    return def;
  }
};

export default function Calendario() {
  const { partecipanti: membri } = usePartecipanti();
  const partecipanti = useMemo(() => [...membri, ...CREW.filter((c) => !membri.includes(c))], [membri]);
  const [mese, setMese] = useState(() => today().slice(0, 7)); // YYYY-MM
  const [sel, setSel] = useState(today());
  const [io, setIo] = useState<string>(() => leggi("ondasonica.me", ""));
  const cal = useDocument<MeseCalendario>("config", meseId(mese + "-01"));
  const concerti = useCollection<DataPresa>("date");

  useEffect(() => {
    try {
      if (io && io !== BAND) localStorage.setItem("ondasonica.me", io); // BAND non è una persona (non va nelle spese)
    } catch {
      /* ignorato */
    }
  }, [io]);

  const celle = useMemo(() => {
    const [y, m] = mese.split("-").map(Number);
    const primo = new Date(y, m - 1, 1);
    const offset = (primo.getDay() + 6) % 7; // lunedì = 0
    const nGiorni = new Date(y, m, 0).getDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= nGiorni; d++) out.push(isoDay(new Date(y, m - 1, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [mese]);

  const concertiPerGiorno = useMemo(() => {
    const map: Record<string, DataPresa[]> = {};
    for (const c of concerti.data) (map[c.data] ??= []).push(c);
    return map;
  }, [concerti.data]);

  const concertiMese = concerti.data.filter((c) => c.data.startsWith(mese));
  const datiMese = cal.data ?? {};
  // Concerti + eventi band del mese, in ordine di data.
  const eventiMese = [
    ...concertiMese.map((c) => ({ key: c.id, data: c.data, cls: "", icona: "🎸", titolo: c.locale, sub: c.indirizzo })),
    ...Object.entries(datiMese).flatMap(([d, g]) =>
      eventiBand(g).map((e) => ({ key: e.id, data: d, cls: `band ev-${e.tipo}`, icona: TIPI_EVENTO[e.tipo].icona, titolo: TIPI_EVENTO[e.tipo].label, sub: e.nota })),
    ),
  ].sort((a, b) => a.data.localeCompare(b.data));

  if (cal.error) return <ErrorBox msg={cal.error} />;

  const dati = cal.data ?? {};
  const spostaMese = (delta: number) => {
    const [y, m] = mese.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMese(isoDay(d).slice(0, 7));
  };
  const titoloMese = new Date(mese + "-15").toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const oggi = today();

  return (
    <div className="page">
      <header className="page-head">
        <h1>Calendario</h1>
        <p className="muted">Impegni e disponibilità della band</p>
      </header>

      <section className="card">
        <span className="field-label">Chi sei?</span>
        <div className="segmented io-picker">
          <button type="button" className={`seg band-seg ${io === BAND ? "on" : ""}`} onClick={() => setIo(BAND)}>
            🎸 BAND
          </button>
          {partecipanti.map((p) => (
            <button key={p} type="button" className={`seg ${io === p ? "on" : ""} ${CREW.includes(p) ? "crew" : ""}`} onClick={() => setIo(p)}>
              {p}
            </button>
          ))}
        </div>
      </section>

      <section className="card cal-card" data-noswipe>
        <div className="cal-head">
          <button className="icon-btn" aria-label="Mese precedente" onClick={() => spostaMese(-1)}>
            ‹
          </button>
          <h3 className="cal-title">{titoloMese}</h3>
          <button className="icon-btn" aria-label="Mese successivo" onClick={() => spostaMese(1)}>
            ›
          </button>
        </div>
        <div className="cal-grid">
          {GIORNI.map((g, i) => (
            <span key={i} className="cal-dow">
              {g}
            </span>
          ))}
          {celle.map((d, i) => {
            if (!d) return <span key={i} />;
            const giorno = dati[d] ?? {};
            const indisp = partecipanti.filter((p) => giorno[p]?.indisponibile);
            const note = partecipanti.filter((p) => giorno[p] && !giorno[p].indisponibile && giorno[p].nota);
            const mioIndisp = io && giorno[io]?.indisponibile;
            const live = concertiPerGiorno[d];
            const tipiBand = [...new Set(eventiBand(giorno).map((e) => e.tipo))];
            return (
              <button
                key={d}
                className={`cal-day ${d === sel ? "sel" : ""} ${d === oggi ? "oggi" : ""} ${indisp.length ? "indisp" : ""} ${mioIndisp ? "mio-indisp" : ""} ${live ? "live" : ""}`}
                onClick={() => setSel(d)}
              >
                <span className="cal-num">{Number(d.slice(8))}</span>
                {live && <span className="cal-live">🎸</span>}
                {live && <span className="cal-live-name">{live[0].locale}</span>}
                {tipiBand.length > 0 && (
                  <span className="cal-band">
                    {tipiBand.map((t) => (
                      <span key={t}>{TIPI_EVENTO[t].icona}</span>
                    ))}
                  </span>
                )}
                <span className="cal-dots">
                  {indisp.map((p) => (
                    <i key={p} className="dot-red" />
                  ))}
                  {note.map((p) => (
                    <i key={p} className="dot-note" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="cal-legend small muted">
          <span>
            <i className="dot-red" /> indisponibile
          </span>
          <span>
            <i className="dot-note" /> impegno segnato
          </span>
          <span>🎸 concerto</span>
          <span>🥁 prove</span>
          <span>🤝 passaggio locale</span>
        </div>
        {eventiMese.length > 0 && (
          <ul className="cal-concerti">
            {eventiMese.map((e) => (
              <li key={e.key}>
                <button className={`${e.data === sel ? "on" : ""} ${e.cls}`} onClick={() => setSel(e.data)}>
                  <span className="cal-concerto-data">{Number(e.data.slice(8))}</span>
                  <span className="grow">
                    {e.icona} <strong>{e.titolo}</strong>
                    {e.sub && <span className="muted small"> · {e.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cal.loading ? (
        <Loading />
      ) : (
        <Giorno
          key={sel + io}
          giorno={sel}
          dati={dati[sel] ?? (sel.slice(0, 7) === mese ? {} : undefined)}
          partecipanti={partecipanti}
          io={io}
          concerti={concertiPerGiorno[sel] ?? []}
          eventi={eventiBand(dati[sel])}
        />
      )}
    </div>
  );
}

function Giorno({
  giorno,
  dati,
  partecipanti,
  io,
  concerti,
  eventi,
}: {
  giorno: string;
  dati?: Record<string, Impegno>;
  partecipanti: string[];
  io: string;
  concerti: DataPresa[];
  eventi: EventoBand[];
}) {
  const save = useSave();
  const mio = dati?.[io];
  const [nota, setNota] = useState(mio?.nota ?? "");
  const [indisp, setIndisp] = useState(mio?.indisponibile ?? false);
  const modificato = nota !== (mio?.nota ?? "") || indisp !== (mio?.indisponibile ?? false);

  // Se il dato cambia da un altro telefono e qui non si sta modificando, riallinea.
  const remoteKey = JSON.stringify(mio ?? null);
  useEffect(() => {
    if (!modificato) {
      setNota(mio?.nota ?? "");
      setIndisp(mio?.indisponibile ?? false);
    }
  }, [remoteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const titolo = new Date(giorno + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="card giorno-card">
      <h3 className="giorno-title">{titolo}</h3>

      {concerti.map((c) => (
        <p key={c.id} className="giorno-live">
          🎸 Concerto: <strong>{c.locale}</strong>
        </p>
      ))}

      {eventi.length > 0 && (
        <ul className="band-eventi">
          {eventi.map((e) => (
            <li key={e.id} className={`band-ev ev-${e.tipo}`}>
              <span className="band-ev-icona">{TIPI_EVENTO[e.tipo].icona}</span>
              <span className="grow">
                <strong>{TIPI_EVENTO[e.tipo].label}</strong>
                {e.nota && <span className="band-ev-nota">{e.nota}</span>}
              </span>
              {io === BAND && (
                <button
                  className="icon-btn"
                  aria-label={`Elimina ${TIPI_EVENTO[e.tipo].label}`}
                  onClick={() => {
                    if (confirm(`Eliminare "${TIPI_EVENTO[e.tipo].label}${e.nota ? " – " + e.nota : ""}"?`))
                      save(rimuoviEventoBand(giorno, e), "Evento eliminato");
                  }}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ul className="giorno-list">
        {partecipanti.map((p) => {
          const imp = dati?.[p];
          return (
            <li key={p} className={`${imp?.indisponibile ? "indisp" : ""} ${p === io ? "me" : ""}`}>
              <span className="who">
                {p}
                {CREW.includes(p) && <small className="crew-tag">crew</small>}
              </span>
              <span className="grow giorno-nota">
                {imp?.indisponibile && <span className="badge-indisp">INDISPONIBILE</span>} {imp?.nota || (!imp ? <span className="muted">—</span> : "")}
              </span>
            </li>
          );
        })}
      </ul>

      {!io ? (
        <p className="hint-box small">Scegli chi sei qui sopra per segnare i tuoi impegni (o BAND per prove e passaggi nei locali).</p>
      ) : io === BAND ? (
        <NuovoEventoBand giorno={giorno} />
      ) : (
        <div className="giorno-edit">
          <span className="field-label">Il mio giorno · {io}</span>
          <textarea
            className="input"
            rows={2}
            placeholder="Cosa farai questo giorno? (es. lavoro fino alle 18, libero la sera)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <button type="button" className={`toggle-indisp ${indisp ? "on" : ""}`} onClick={() => setIndisp(!indisp)} aria-pressed={indisp}>
            <span className="box">{indisp ? "✕" : ""}</span>
            {indisp ? "Indisponibile in questo giorno" : "Segna come indisponibile"}
          </button>
          <button
            className="btn primary block"
            disabled={!modificato}
            onClick={() => save(salvaImpegno(giorno, io, { nota, indisponibile: indisp }), "Calendario salvato")}
          >
            Salva
          </button>
        </div>
      )}
    </section>
  );
}

function NuovoEventoBand({ giorno }: { giorno: string }) {
  const save = useSave();
  const [tipo, setTipo] = useState<TipoEvento>("prove");
  const [nota, setNota] = useState("");
  return (
    <div className="giorno-edit">
      <span className="field-label">Nuovo evento band</span>
      <div className="tipo-evento">
        {(Object.keys(TIPI_EVENTO) as TipoEvento[]).map((t) => (
          <button key={t} type="button" className={`tipo-btn ev-${t} ${tipo === t ? "on" : ""}`} onClick={() => setTipo(t)}>
            <span className="tipo-icona">{TIPI_EVENTO[t].icona}</span>
            {TIPI_EVENTO[t].label}
          </button>
        ))}
      </div>
      <input
        className="input"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder={tipo === "prove" ? "Es. ore 21, sala prove" : "Es. ore 18, giro locali a Chieri e Rivoli"}
      />
      <button
        className="btn primary block"
        onClick={() => {
          save(aggiungiEventoBand(giorno, tipo, nota), `${TIPI_EVENTO[tipo].label} salvato`);
          setNota("");
        }}
      >
        Salva evento
      </button>
    </div>
  );
}
