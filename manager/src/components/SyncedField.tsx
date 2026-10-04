import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  label?: string;
  type?: string;
  rows?: number;
  className?: string;
}

/**
 * Campo di testo collegato a un valore remoto (realtime).
 * - Salva automaticamente dopo una breve pausa di digitazione e all'uscita dal campo.
 * - Mentre l'utente scrive, gli aggiornamenti remoti non sovrascrivono il testo;
 *   quando il campo non è in uso si riallinea al valore condiviso.
 */
export function SyncedField({ value, onSave, multiline, placeholder, label, type = "text", rows = 3, className }: Props) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  const lastSaved = useRef(value);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!focused.current) {
      setLocal(value);
      lastSaved.current = value;
    }
  }, [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flush = (v: string) => {
    window.clearTimeout(timer.current);
    if (v !== lastSaved.current) {
      lastSaved.current = v;
      onSave(v);
    }
  };

  const onChange = (v: string) => {
    setLocal(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(v), 900);
  };

  const common = {
    value: local,
    placeholder,
    className: `input ${className ?? ""}`,
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false;
      flush(local);
    },
  };

  const field = multiline ? (
    <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
  );

  if (!label) return field;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {field}
    </label>
  );
}
