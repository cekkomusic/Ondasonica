import { useState } from "react";
import { Link } from "react-router-dom";
import { aggiungiVideo, rimuoviVideo, salvaListaVideo, useDemo, ytId, type VideoDemo } from "../lib/presentazione";
import { useSave } from "../components/Toast";
import { Loading } from "../components/States";

export default function Demo() {
  const { video, loading } = useDemo();
  const [modifica, setModifica] = useState(false);
  if (loading) return <Loading />;

  return (
    <div className="page">
      <header className="page-head row between">
        <div>
          <h1>Demo</h1>
          <p className="muted">OndaSonicA dal vivo</p>
        </div>
        <button className={`btn ghost sm ${modifica ? "on-edit" : ""}`} onClick={() => setModifica(!modifica)}>
          {modifica ? "✓ Fatto" : "✎ Modifica"}
        </button>
      </header>

      {modifica && <NuovoVideo />}

      {video.length === 0 && !modifica && (
        <div className="card empty-card">
          <p>Nessun video ancora.</p>
          <button className="btn primary" onClick={() => setModifica(true)}>
            + Aggiungi il primo video
          </button>
        </div>
      )}

      <div className="video-list">
        {video.map((v, i) => (
          <VideoCard key={v.id} v={v} modifica={modifica} indice={i} lista={video} />
        ))}
      </div>

      <Link to="/booking" className="card doc-link">
        <span>📸</span>
        <strong className="grow">Booking · foto ufficiali e contatti</strong>
        <span>→</span>
      </Link>
    </div>
  );
}

function VideoCard({ v, modifica, indice, lista }: { v: VideoDemo; modifica: boolean; indice: number; lista: VideoDemo[] }) {
  const save = useSave();
  const [play, setPlay] = useState(false);
  const sposta = (d: -1 | 1) => {
    const next = [...lista];
    const [m] = next.splice(indice, 1);
    next.splice(indice + d, 0, m);
    save(salvaListaVideo(next), "Ordine salvato");
  };

  return (
    <article className="card video-card">
      <div className="video-frame">
        {play ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${v.ytId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
            title={v.titolo || "Video OndaSonicA"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button className="video-thumb" onClick={() => setPlay(true)} aria-label={`Riproduci ${v.titolo}`}>
            <img src={`https://i.ytimg.com/vi/${v.ytId}/hqdefault.jpg`} alt="" loading="lazy" />
            <span className="play-btn" aria-hidden>
              ▶
            </span>
          </button>
        )}
      </div>
      <div className="video-info">
        {modifica ? (
          <input
            className="input"
            defaultValue={v.titolo}
            placeholder="Titolo del video"
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t !== v.titolo) save(salvaListaVideo(lista.map((x) => (x.id === v.id ? { ...x, titolo: t } : x))), "Titolo salvato");
            }}
          />
        ) : (
          <h3>{v.titolo || "Video"}</h3>
        )}
        <a className="ext small" href={v.url} target="_blank" rel="noreferrer">
          Apri su YouTube ↗
        </a>
      </div>
      {modifica && (
        <div className="row video-edit">
          <button className="btn ghost sm" disabled={indice === 0} onClick={() => sposta(-1)} aria-label="Sposta su">
            ↑
          </button>
          <button className="btn ghost sm" disabled={indice === lista.length - 1} onClick={() => sposta(1)} aria-label="Sposta giù">
            ↓
          </button>
          <span className="grow" />
          <button
            className="btn danger ghost sm"
            onClick={() => confirm(`Togliere "${v.titolo || "questo video"}" dalle demo?`) && save(rimuoviVideo(v), "Video rimosso")}
          >
            Elimina
          </button>
        </div>
      )}
    </article>
  );
}

function NuovoVideo() {
  const save = useSave();
  const [url, setUrl] = useState("");
  const [titolo, setTitolo] = useState("");
  const id = ytId(url);
  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!id) return;
        save(aggiungiVideo(url, titolo), "Video aggiunto");
        setUrl("");
        setTitolo("");
      }}
    >
      <h3>Aggiungi video</h3>
      <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link YouTube (es. https://youtu.be/…)" inputMode="url" />
      {url.trim() && !id && <p className="small warn-text">Link YouTube non riconosciuto.</p>}
      {id && <img className="video-preview" src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="Anteprima" />}
      <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo (es. Live al cinema Space – Discolabirinto)" />
      <button className="btn primary" type="submit" disabled={!id}>
        Aggiungi
      </button>
    </form>
  );
}
