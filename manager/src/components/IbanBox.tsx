import { copiaTesto, ibanCompatto, ibanLeggibile } from "../lib/iban";
import { useSave } from "./Toast";

/** IBAN in evidenza con tasto copia. */
export function IbanBox({ iban, nome }: { iban: string; nome?: string }) {
  const save = useSave();
  return (
    <div className="iban-box">
      <span className="iban-ico" aria-hidden>
        🏦
      </span>
      <span className="grow iban-text selectable">
        {nome && <span className="iban-nome">{nome}</span>}
        <span className="iban-val">{ibanLeggibile(iban)}</span>
      </span>
      <button
        type="button"
        className="copy-btn"
        aria-label="Copia IBAN"
        title="Copia IBAN"
        onClick={(e) => {
          e.stopPropagation();
          save(copiaTesto(ibanCompatto(iban)), "IBAN copiato");
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
          <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
        </svg>
      </button>
    </div>
  );
}
