import { COLORI, disposizione, MUSICISTI, percorso, puntoPorta, type Capo, type Collegamenti } from "../lib/collegamenti";

interface Props {
  dati: Collegamenti;
  /** porta di uscita selezionata (in attesa di un ingresso) */
  selezione?: Capo | null;
  cavoAttivo?: string | null;
  onPorta?: (c: Capo, lato: "in" | "out") => void;
  onCavo?: (id: string) => void;
  /** versione per il PDF: colori chiari, niente interazione */
  stampa?: boolean;
}

/** Disegno dei collegamenti: dispositivi in colonne, porte (● uscite a destra, ○ ingressi a sinistra) e cavi. */
export function SchemaCollegamenti({ dati, selezione, cavoAttivo, onPorta, onCavo, stampa }: Props) {
  const { boxes, larghezza, altezza } = disposizione();
  const box = (id: string) => boxes.find((b) => b.d.id === id);
  const sfondo = stampa ? "#ffffff" : "#0d0d16";
  const testo = stampa ? "#15151d" : "#ecebf5";
  const tenue = stampa ? "#555" : "#9a98b3";
  const cornice = stampa ? "#cfcfe0" : "#2a2a40";
  const collegati = new Set(dati.cavi.flatMap((c) => [`${c.da.dev}:${c.da.porta}:out`, `${c.a.dev}:${c.a.porta}:in`]));

  return (
    <svg
      viewBox={`0 0 ${larghezza} ${altezza}`}
      width={larghezza}
      height={altezza}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: sfondo, fontFamily: "Inter, Arial, sans-serif", display: "block" }}
    >
      {["Strumenti", "Effetti · ampli · synth", "Mixer batteria", "Behringer X18", "In-ear e spie"].map((t, i) => (
        <text key={t} x={[10, 250, 500, 740, 1020][i]} y={22} fontSize={13} fontWeight={700} fill={tenue}>
          {t.toUpperCase()}
        </text>
      ))}

      {MUSICISTI.map((m, i) => (
        <g key={m}>
          <circle cx={14 + i * 92} cy={40} r={5} fill={COLORI[m]} />
          <text x={23 + i * 92} y={43.5} fontSize={10.5} fontWeight={700} fill={COLORI[m]}>
            {m}
          </text>
        </g>
      ))}

      {boxes.map((b) => {
        const col = COLORI[b.d.gruppo] ?? "#888";
        return (
          <g key={b.d.id}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={stampa ? "#fafaff" : "#16162a"} stroke={col} strokeWidth={1.5} />
            <text x={b.x + 8} y={b.y + 16} fontSize={11.5} fontWeight={700} fill={testo}>
              {b.d.nome}
            </text>

            {b.d.ingressi.map((p) => {
              const pt = puntoPorta(b, p.id, "in");
              const nome = dati.canali[`${b.d.id}:${p.id}`];
              const attivo = collegati.has(`${b.d.id}:${p.id}:in`);
              return (
                <g key={`i${p.id}`} onClick={onPorta ? () => onPorta({ dev: b.d.id, porta: p.id }, "in") : undefined} style={onPorta ? { cursor: "pointer" } : undefined}>
                  <text x={pt.x + 10} y={pt.y + 3.5} fontSize={10} fill={tenue}>
                    {p.label}
                    {nome ? <tspan fill={testo}>{` ${nome}`}</tspan> : null}
                  </text>
                  <circle cx={pt.x} cy={pt.y} r={5} fill={attivo ? col : sfondo} stroke={col} strokeWidth={1.5} />
                  {onPorta && <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />}
                </g>
              );
            })}
            {b.d.uscite.map((p) => {
              const pt = puntoPorta(b, p.id, "out");
              const nome = dati.canali[`${b.d.id}:${p.id}`];
              const sel = selezione?.dev === b.d.id && selezione.porta === p.id;
              return (
                <g key={`o${p.id}`} onClick={onPorta ? () => onPorta({ dev: b.d.id, porta: p.id }, "out") : undefined} style={onPorta ? { cursor: "pointer" } : undefined}>
                  <text x={pt.x - 10} y={pt.y + 3.5} fontSize={10} textAnchor="end" fill={tenue}>
                    {nome ? <tspan fill={testo}>{`${nome} `}</tspan> : null}
                    {p.label}
                  </text>
                  <circle cx={pt.x} cy={pt.y} r={sel ? 7.5 : 5} fill={col} stroke={sel ? "#fff" : col} strokeWidth={sel ? 2.5 : 1} />
                  {onPorta && <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />}
                </g>
              );
            })}
          </g>
        );
      })}

      {dati.cavi.map((c) => {
        const bd = box(c.da.dev);
        const ba = box(c.a.dev);
        if (!bd || !ba) return null;
        const p1 = puntoPorta(bd, c.da.porta, "out");
        const p2 = puntoPorta(ba, c.a.porta, "in");
        const col = COLORI[bd.d.gruppo] ?? "#888";
        const attivo = cavoAttivo === c.id;
        const d = percorso(p1, p2, ba.y - 7);
        return (
          <g key={c.id} onClick={onCavo ? () => onCavo(c.id) : undefined} style={onCavo ? { cursor: "pointer" } : undefined}>
            {onCavo && <path d={d} stroke="transparent" strokeWidth={12} fill="none" />}
            <path d={d} stroke={col} strokeWidth={attivo ? 3.5 : 1.8} fill="none" opacity={cavoAttivo && !attivo ? 0.35 : 0.9} />
          </g>
        );
      })}
    </svg>
  );
}
