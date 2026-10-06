import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isYoutube, normalizzaLink, salvaTesto, salvaYoutube, type InfoBrano } from "../lib/brani";
import { useSave } from "./Toast";

/**
 * Schermata intera di un brano: testo leggibile (con dimensione regolabile), modifica del testo e del link YouTube.
 * Si chiude con la X in alto a destra, con Esc o con il tasto Indietro del telefono.
 */
export function BranoOverlay({
  titolo,
  info,
  modo,
  onClose,
}: {
  titolo: string;
  info?: InfoBrano;
  modo: "testo" | "youtube";
  onClose: () => void;
}) {
  const save = useSave();
  const testo = info?.testo ?? "";
  const [modifica, setModifica] = useState(modo === "testo" && !testo);
  const [bozza, setBozza] = useState(testo);
  const [link, setLink] = useState(info?.youtube ?? "");
  const [linkAperto, setLinkAperto] = useState(modo === "youtube");
  const [dim, setDim] = useState(() => {
    try {
      return Number(localStorage.getItem("ondasonica.testoDim")) || 20;
    } catch {
      return 20;
    }
  });
  const chiuso = useRef(false);

  // Tasto Indietro di Android = chiudi.
  useEffect(() => {
    history.pushState({ ...(history.state ?? {}), brano: true }, "");
    const onPop = () => {
      chiuso.current = true;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && chiudi();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chiudi = () => {
    if (chiuso.current) return;
    chiuso.current = true;
    history.back(); // rimuove lo stato aggiunto all'apertura
    onClose();
  };

  const cambiaDim = (d: number) => {
    const v = Math.min(36, Math.max(14, d));
    setDim(v);
    try {
      localStorage.setItem("ondasonica.testoDim", String(v));
    } catch {
      /* ignorato */
    }
  };

  const linkNorm = normalizzaLink(link);
  const linkValido = !link.trim() || Boolean(linkNorm);

  return createPortal(
    <div className="brano-overlay" role="dialog" aria-modal="true" aria-label={titolo}>
      <header className="brano-head">
        <h2>{titolo}</h2>
        <button className="brano-x" aria-label="Chiudi" onClick={chiudi}>
          ✕
        </button>
      </header>

      <div className="brano-tools">
        {!modifica && testo && (
          <>
            <button className="btn ghost sm" onClick={() => cambiaDim(dim - 2)} aria-label="Testo più piccolo">
              A−
            </button>
            <button className="btn ghost sm" onClick={() => cambiaDim(dim + 2)} aria-label="Testo più grande">
              A+
            </button>
          </>
        )}
        <span className="grow" />
        {info?.youtube && (
          <a className="btn yt sm" href={info.youtube} target="_blank" rel="noreferrer">
            ▶ YouTube
          </a>
        )}
        <button className="btn ghost sm" onClick={() => setLinkAperto(!linkAperto)}>
          {info?.youtube ? "Cambia link" : "+ Link YouTube"}
        </button>
        {!modifica && (
          <button
            className="btn ghost sm"
            onClick={() => {
              setBozza(testo);
              setModifica(true);
            }}
          >
            {testo ? "✎ Modifica testo" : "+ Testo"}
          </button>
        )}
      </div>

      {linkAperto && (
        <form
          className="brano-link"
          onSubmit={(e) => {
            e.preventDefault();
            if (!linkValido) return;
            save(salvaYoutube(titolo, linkNorm), linkNorm ? "Link YouTube salvato" : "Link YouTube rimosso");
            setLinkAperto(false);
          }}
        >
          <input
            className="input"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Incolla il link YouTube (es. https://youtu.be/…)"
            inputMode="url"
            autoFocus={modo === "youtube"}
          />
          {!linkValido && <p className="small warn-text">Il link non sembra valido.</p>}
          {linkNorm && !isYoutube(linkNorm) && <p className="small muted">Non è un link YouTube, ma verrà salvato lo stesso.</p>}
          <div className="row end">
            <button type="button" className="btn ghost sm" onClick={() => setLinkAperto(false)}>
              Annulla
            </button>
            <button type="submit" className="btn primary sm" disabled={!linkValido}>
              Salva link
            </button>
          </div>
        </form>
      )}

      <div className="brano-body">
        {modifica ? (
          <div className="brano-edit">
            <textarea
              className="input brano-textarea"
              value={bozza}
              onChange={(e) => setBozza(e.target.value)}
              placeholder="Incolla qui il testo del brano…"
              autoFocus={modo === "testo"}
            />
            <div className="row end">
              {testo && (
                <button className="btn ghost" onClick={() => setModifica(false)}>
                  Annulla
                </button>
              )}
              <button
                className="btn primary"
                onClick={() => {
                  save(salvaTesto(titolo, bozza), "Testo salvato");
                  setModifica(false);
                }}
                disabled={bozza === testo}
              >
                Salva testo
              </button>
            </div>
          </div>
        ) : testo ? (
          <pre className="brano-testo selectable" style={{ fontSize: dim }}>
            {testo}
          </pre>
        ) : (
          <p className="muted">Nessun testo per questo brano.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
