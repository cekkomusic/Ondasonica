interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  classFor?: (v: T) => string;
}

/** Selettore a pulsanti grandi (touch-friendly), alternativa a <select>. */
export function Segmented<T extends string>({ options, value, onChange, classFor }: Props<T>) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          className={`seg ${o === value ? "on" : ""} ${classFor ? classFor(o) : ""}`}
          onClick={() => {
            if (o !== value) onChange(o);
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
