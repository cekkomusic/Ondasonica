import type { Priorita, StatoAttivita, StatoContatto } from "../lib/types";

const prioClass: Record<Priorita, string> = {
  Alta: "prio-alta",
  "Media-Alta": "prio-mediaalta",
  Media: "prio-media",
  "Info/Concorrenza": "prio-info",
};

export function PrioBadge({ p }: { p: Priorita }) {
  return <span className={`badge ${prioClass[p] ?? "prio-info"}`}>{p}</span>;
}

const statoClass: Record<StatoContatto, string> = {
  "Da contattare": "st-todo",
  Contattato: "st-sent",
  "Risposta ricevuta": "st-reply",
  "Data fissata": "st-done",
  "Non interessato": "st-no",
};

export function StatoBadge({ s }: { s: StatoContatto }) {
  return (
    <span className={`stato ${statoClass[s] ?? "st-todo"}`}>
      <i />
      {s}
    </span>
  );
}

export const attivitaClass: Record<StatoAttivita, string> = {
  "Da fare": "st-todo",
  "In corso": "st-sent",
  "Da completare": "st-reply",
  Completata: "st-done",
};

export { prioClass, statoClass };
