import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SchedaTecnica } from "../lib/types";
import { FoglioScheda } from "./FoglioScheda";
import { caricaImmagine, generaFile, puoCondividereFile, scaricaFile, type Formato } from "../lib/esporta";
import { useSave } from "./Toast";
import { tick } from "../lib/haptics";
import { today } from "../lib/format";

const TESTO = "Scheda tecnica di OndaSonicA – Subsonica Tribute Band";

/** Pulsante + pannello per esportare la scheda tecnica in PDF/JPG e condividerla. */
export function EsportaScheda({ scheda }: { scheda: SchedaTecnica }) {
  const save = useSave();
  const [aperto, setAperto] = useState(false);
  const [lavoro, setLavoro] = useState<Formato | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<{ src?: string; errore?: string }>({});
  const foglio = useRef<HTMLDivElement>(null);
  const url = scheda.stagePlot?.immagineUrl?.trim() ?? "";

  // Prepara l'immagine dello stage plot quando si apre il pannello.
  useEffect(() => {
    if (!aperto || !url) return setImg({});
    let vivo = true;
    let creato: string | undefined;
    caricaImmagine(url).then((r) => {
      if (!vivo) return r.src && URL.revokeObjectURL(r.src);
      creato = r.src;
      setImg(r);
    });
    return () => {
      vivo = false;
      if (creato) URL.revokeObjectURL(creato);
    };
  }, [aperto, url]);

  const esporta = async (formato: Formato) => {
    if (!foglio.current) return;
    setLavoro(formato);
    setFile(null);
    try {
      const f = await generaFile(foglio.current, formato, `OndaSonicA_Scheda_Tecnica_${today()}`);
      setFile(f);
      tick();
    } catch (e) {
      save(Promise.reject(e instanceof Error ? e : new Error("esportazione non riuscita")));
    } finally {
      setLavoro(null);
    }
  };

  const condividi = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: TESTO, text: TESTO });
    } catch (e) {
      if ((e as Error).name !== "AbortError") scaricaFile(file);
    }
  };

  const caricamentoImg = aperto && url && !img.src && !img.errore;

  if (!aperto)
    return (
      <button className="btn primary block" onClick={() => setAperto(true)}>
        📤 Esporta PDF / JPG e condividi
      </button>
    );

  return (
    <section className="card esporta-card">
      <div className="row between">
        <h3>📤 Esporta scheda tecnica</h3>
        <button className="icon-btn" aria-label="Chiudi" onClick={() => (setAperto(false), setFile(null))}>
          ✕
        </button>
      </div>
      <p className="muted small">
        Crea un file con tutti i campi compilati{url ? " e la foto dello stage plot" : ""}, pronto da mandare a locali e fonici.
      </p>
      {caricamentoImg && <p className="small muted">⏳ Carico la foto dello stage plot…</p>}
      {img.src && <p className="small ok-text">✓ Foto dello stage plot inclusa</p>}
      {img.errore && <p className="small warn-text">⚠️ Foto non inclusa: {img.errore}. Nel file comparirà il link.</p>}

      <div className="row two">
        <button className="btn primary" disabled={!!lavoro || !!caricamentoImg} onClick={() => esporta("pdf")}>
          {lavoro === "pdf" ? "Creo il PDF…" : "📄 PDF"}
        </button>
        <button className="btn primary" disabled={!!lavoro || !!caricamentoImg} onClick={() => esporta("jpg")}>
          {lavoro === "jpg" ? "Creo il JPG…" : "🖼️ JPG"}
        </button>
      </div>

      {file && (
        <div className="esporta-ok">
          <p className="small">
            ✓ <strong>{file.name}</strong> ({Math.max(1, Math.round(file.size / 1024))} KB)
          </p>
          {puoCondividereFile(file) ? (
            <button className="btn live-btn block" onClick={condividi}>
              📲 Condividi (WhatsApp, email, Telegram…)
            </button>
          ) : (
            <p className="hint-box small">
              Questo browser non permette di condividere file direttamente: scarica il file e allegalo su WhatsApp o nell'email.
            </p>
          )}
          <div className="row two">
            <button className="btn ghost" onClick={() => scaricaFile(file)}>
              ⬇️ Scarica
            </button>
            <button className="btn ghost" onClick={() => window.open(URL.createObjectURL(file), "_blank")}>
              👁️ Anteprima
            </button>
          </div>
          <div className="row two">
            <a
              className="btn ghost"
              href={`https://wa.me/?text=${encodeURIComponent(TESTO + " (in allegato)")}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => scaricaFile(file)}
            >
              WhatsApp
            </a>
            <a
              className="btn ghost"
              href={`mailto:?subject=${encodeURIComponent(TESTO)}&body=${encodeURIComponent("Buongiorno,\n\nin allegato la scheda tecnica di OndaSonicA.\n\nGrazie,\nOndaSonicA")}`}
              onClick={() => scaricaFile(file)}
            >
              ✉️ Email
            </a>
          </div>
          <p className="muted tiny">WhatsApp ed Email: il file viene scaricato, poi va allegato a mano. Con "Condividi" invece è già allegato.</p>
        </div>
      )}

      {/* Foglio fuori schermo usato per generare il file */}
      {createPortal(
        <div className="foglio-wrap" aria-hidden>
          <FoglioScheda ref={foglio} scheda={scheda} immagine={img.src} erroreImmagine={img.errore} />
        </div>,
        document.body,
      )}
    </section>
  );
}
