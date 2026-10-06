import { forwardRef } from "react";
import type { SchedaTecnica } from "../lib/types";
import { SEZIONI } from "../lib/schedaSezioni";

const pieno = (v?: string) => Boolean(v && v.trim());

/** Versione stampabile della scheda tecnica (sfondo chiaro, larghezza A4). Solo i campi compilati. */
export const FoglioScheda = forwardRef<HTMLDivElement, { scheda: SchedaTecnica; immagine?: string; erroreImmagine?: string }>(
  function FoglioScheda({ scheda, immagine, erroreImmagine }, ref) {
    const formazione = (scheda.formazione ?? []).filter((m) => pieno(m.nome) || pieno(m.ruolo));
    const aggiornato = scheda.aggiornato ? new Date(scheda.aggiornato).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";
    return (
      <div ref={ref} className="foglio">
        <header className="foglio-head" data-blocco>
          <img src="/logo.png" alt="" className="foglio-logo" />
          <div>
            <p className="foglio-kicker">Scheda tecnica · Rider</p>
            <h1>{scheda.bandNome || "OndaSonicA"}</h1>
            <p className="foglio-sub">Subsonica Tribute Band{aggiornato ? ` · aggiornata il ${aggiornato}` : ""}</p>
          </div>
        </header>

        {formazione.length > 0 && (
          <section data-blocco>
            <h2>Formazione</h2>
            <table className="foglio-tab">
              <tbody>
                {formazione.map((m, i) => (
                  <tr key={i}>
                    <td className="k">{m.nome}</td>
                    <td>{m.ruolo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {SEZIONI.map((sez) => {
          const valori = (scheda[sez.key] ?? {}) as Record<string, string>;
          const campi = Object.entries(sez.campi).filter(([k]) => k !== "immagineUrl" && pieno(valori[k]));
          const conImmagine = sez.key === "stagePlot" && (immagine || pieno(valori.immagineUrl));
          if (!campi.length && !conImmagine) return null;
          return (
            <section key={sez.key} data-blocco>
              <h2>{sez.titolo}</h2>
              {campi.length > 0 && (
                <table className="foglio-tab">
                  <tbody>
                    {campi.map(([k, c]) => (
                      <tr key={k}>
                        <td className="k">{c.label}</td>
                        <td className="pre">{valori[k]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {sez.key === "stagePlot" && immagine && <img className="foglio-plot" src={immagine} alt="Stage plot" />}
              {sez.key === "stagePlot" && !immagine && pieno(valori.immagineUrl) && (
                <p className="foglio-nota">
                  Immagine stage plot: {valori.immagineUrl}
                  {erroreImmagine ? ` (non inclusa: ${erroreImmagine})` : ""}
                </p>
              )}
            </section>
          );
        })}

        {pieno(scheda.noteGenerali) && (
          <section data-blocco>
            <h2>Note generali</h2>
            <p className="pre">{scheda.noteGenerali}</p>
          </section>
        )}

        <footer className="foglio-foot" data-blocco>
          OndaSonicA – Subsonica Tribute Band · Torino
        </footer>
      </div>
    );
  },
);
