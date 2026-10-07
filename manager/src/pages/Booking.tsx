import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { caricaFoto, rimuoviFoto, salvaBooking, useBooking, useFotoDati } from "../lib/presentazione";
import { SyncedField } from "../components/SyncedField";
import { FotoViewer } from "../components/FotoViewer";
import { useSave } from "../components/Toast";
import { Loading } from "../components/States";

const TESTO_BASE =
  "OndaSonicA è la tribute band dei Subsonica con base a Torino, la stessa città in cui è nata la band originale.\n\n" +
  "Lo show ripercorre il repertorio storico dei Subsonica, suonato dal vivo \"in griglia\" con metronomo in cuffia, " +
  "ed è accompagnato da visuals proiettate sul palco e sincronizzate con ogni brano: un vero spettacolo audio-video, non solo un concerto tributo.";

export default function Booking() {
  const { data, loading } = useBooking();
  const save = useSave();
  const [modifica, setModifica] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [caricando, setCaricando] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const foto = data?.foto ?? [];
  const dati = useFotoDati(foto.map((f) => f.id));

  if (loading) return <Loading />;
  const b = data ?? {};
  const tel = (b.contattoTelefono ?? "").replace(/[^\d+]/g, "");
  const wa = tel.replace(/^\+/, "").replace(/^(?!39)(3\d{8,9})$/, "39$1");

  const carica = async (files: FileList | null) => {
    if (!files?.length) return;
    const lista = Array.from(files);
    setCaricando(lista.length);
    let ok = 0;
    for (const file of lista) {
      try {
        await caricaFoto(file, file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
        ok++;
      } catch (e) {
        save(Promise.reject(e));
      }
      setCaricando((n) => n - 1);
    }
    if (ok) save(Promise.resolve(), ok === 1 ? "Foto caricata" : `${ok} foto caricate`);
  };

  return (
    <div className="page">
      <header className="page-head row between">
        <div>
          <h1>Booking</h1>
          <p className="muted">Subsonica Tribute Band · Torino</p>
        </div>
        <button className={`btn ghost sm ${modifica ? "on-edit" : ""}`} onClick={() => setModifica(!modifica)}>
          {modifica ? "✓ Fatto" : "✎ Modifica"}
        </button>
      </header>

      <section className="card booking-hero">
        <img src="/logo.png" alt="OndaSonicA – Subsonica Tribute Band" className="booking-logo" />
        {modifica ? (
          <>
            <SyncedField label="Presentazione" multiline rows={7} value={b.presentazione ?? ""} onSave={(v) => save(salvaBooking({ presentazione: v }))} />
            {!b.presentazione && (
              <button className="btn ghost sm" onClick={() => save(salvaBooking({ presentazione: TESTO_BASE }), "Testo inserito")}>
                Usa un testo di partenza
              </button>
            )}
          </>
        ) : b.presentazione ? (
          <p className="booking-testo">{b.presentazione}</p>
        ) : (
          <p className="muted small">Nessuna presentazione. Premi ✎ Modifica per scriverla.</p>
        )}
      </section>

      <section className="card">
        <h3>📸 Foto ufficiali</h3>
        {foto.length === 0 && <p className="muted small">Nessuna foto. {modifica ? "" : "Premi ✎ Modifica per caricarle."}</p>}
        <div className="foto-grid">
          {foto.map((f, i) => (
            <div key={f.id} className="foto-cell">
              <button className="foto-thumb" onClick={() => setViewer(i)} aria-label={`Apri ${f.titolo}`}>
                {dati[f.id] ? <img src={dati[f.id]} alt={f.titolo} loading="lazy" /> : <span className="muted small">…</span>}
              </button>
              {modifica && (
                <button
                  className="foto-del"
                  aria-label={`Elimina ${f.titolo}`}
                  onClick={() => confirm("Eliminare questa foto?") && save(rimuoviFoto(f.id, foto), "Foto eliminata")}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {modifica && (
          <>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (carica(e.target.files), (e.target.value = ""))} />
            <button className="btn primary block" disabled={caricando > 0} onClick={() => input.current?.click()}>
              {caricando > 0 ? `Carico ${caricando} foto…` : "+ Carica foto"}
            </button>
            <p className="muted tiny">Le foto vengono ridotte (max 1600 px) per stare nel database gratuito.</p>
          </>
        )}
      </section>

      <section className="card">
        <h3>📞 Contatti booking</h3>
        {modifica ? (
          <div className="form-card">
            <SyncedField label="Referente" value={b.contattoNome ?? ""} placeholder="Nome" onSave={(v) => save(salvaBooking({ contattoNome: v }))} />
            <SyncedField label="Telefono" type="tel" value={b.contattoTelefono ?? ""} placeholder="+39 …" onSave={(v) => save(salvaBooking({ contattoTelefono: v }))} />
            <SyncedField label="Email" type="email" value={b.contattoEmail ?? ""} placeholder="booking@…" onSave={(v) => save(salvaBooking({ contattoEmail: v }))} />
            <SyncedField label="Instagram / Facebook / sito" value={b.social ?? ""} placeholder="https://…" onSave={(v) => save(salvaBooking({ social: v }))} />
          </div>
        ) : b.contattoNome || tel || b.contattoEmail || b.social ? (
          <div className="contatti">
            {b.contattoNome && <p className="contatto-nome">{b.contattoNome}</p>}
            <div className="contatti-btns">
              {tel && (
                <a className="btn ghost sm" href={`tel:${tel}`}>
                  📞 {b.contattoTelefono}
                </a>
              )}
              {wa && (
                <a className="btn ghost sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                  💬 WhatsApp
                </a>
              )}
              {b.contattoEmail && (
                <a className="btn ghost sm" href={`mailto:${b.contattoEmail}`}>
                  ✉️ {b.contattoEmail}
                </a>
              )}
              {b.social && (
                <a className="btn ghost sm" href={/^https?:/.test(b.social) ? b.social : `https://${b.social}`} target="_blank" rel="noreferrer">
                  🌐 Social / sito
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="muted small">Nessun contatto. Premi ✎ Modifica per inserirlo.</p>
        )}
      </section>

      <Link to="/demo" className="card doc-link">
        <span>🎬</span>
        <strong className="grow">Guarda le demo video</strong>
        <span>→</span>
      </Link>

      {viewer !== null && foto.length > 0 && <FotoViewer foto={foto} dati={dati} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
