import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fileDaDataUrl } from "../lib/presentazione";
import { puoCondividereFile, scaricaFile } from "../lib/esporta";

/** Foto a schermo intero: frecce o swipe per scorrere, condividi/scarica, X o Indietro per chiudere. */
export function FotoViewer({
  foto,
  dati,
  start,
  onClose,
}: {
  foto: { id: string; titolo: string }[];
  dati: Record<string, string>;
  start: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(start);
  const chiuso = useRef(false);
  const x0 = useRef(0);
  const f = foto[i];
  const src = f ? dati[f.id] : undefined;

  useEffect(() => {
    history.pushState({ ...(history.state ?? {}), foto: true }, "");
    const onPop = () => {
      chiuso.current = true;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") chiudi();
      if (e.key === "ArrowRight") vai(1);
      if (e.key === "ArrowLeft") vai(-1);
    };
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
    history.back();
    onClose();
  };
  const vai = (d: number) => setI((n) => (n + d + foto.length) % foto.length);

  const condividi = async () => {
    if (!src || !f) return;
    const file = await fileDaDataUrl(src, `OndaSonicA_${(f.titolo || f.id).replace(/[^\w-]+/g, "_")}.jpg`);
    if (puoCondividereFile(file)) {
      try {
        await navigator.share({ files: [file], title: "OndaSonicA – Subsonica Tribute Band" });
      } catch {
        /* annullato */
      }
    } else scaricaFile(file);
  };

  return createPortal(
    <div
      className="foto-viewer"
      data-noswipe
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => (x0.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - x0.current;
        if (Math.abs(dx) > 60) vai(dx < 0 ? 1 : -1);
      }}
    >
      <header className="foto-viewer-head">
        <span className="small muted">
          {i + 1} / {foto.length}
          {f?.titolo ? ` · ${f.titolo}` : ""}
        </span>
        <span className="grow" />
        <button className="btn ghost sm" onClick={condividi}>
          📲 Condividi
        </button>
        <button className="brano-x" aria-label="Chiudi" onClick={chiudi}>
          ✕
        </button>
      </header>
      <div className="foto-viewer-img">{src ? <img src={src} alt={f?.titolo ?? ""} /> : <p className="muted">Caricamento…</p>}</div>
      {foto.length > 1 && (
        <>
          <button className="foto-nav prev" aria-label="Foto precedente" onClick={() => vai(-1)}>
            ‹
          </button>
          <button className="foto-nav next" aria-label="Foto successiva" onClick={() => vai(1)}>
            ›
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
