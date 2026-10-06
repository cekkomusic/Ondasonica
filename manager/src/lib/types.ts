export const PRIORITA = ["Alta", "Media-Alta", "Media", "Info/Concorrenza"] as const;
export type Priorita = (typeof PRIORITA)[number];

export const STATI_CONTATTO = [
  "Da contattare",
  "Contattato",
  "Risposta ricevuta",
  "Data fissata",
  "Non interessato",
] as const;
export type StatoContatto = (typeof STATI_CONTATTO)[number];

export interface Lead {
  id: string;
  ordine: number;
  priorita: Priorita;
  nome: string;
  tipo: string;
  comune: string;
  regione: string;
  periodo2026: string;
  genere: string;
  contatto: string;
  noteRicerca: string;
  fonte: string;
  statoContatto: StatoContatto;
  notaUtente: string;
  dataUltimoContatto: string | null;
}

// "Da completare" è presente nel seed (EPK parzialmente fatto): lo manteniamo
// come stato a sé invece di convertirlo silenziosamente.
export const STATI_ATTIVITA = ["Da fare", "In corso", "Da completare", "Completata"] as const;
export type StatoAttivita = (typeof STATI_ATTIVITA)[number];

export interface Attivita {
  id: string;
  titolo: string;
  descrizione: string;
  stato: StatoAttivita;
  data: string; // YYYY-MM-DD
  note: string;
  createdAt?: number;
}

export interface Pagamento {
  pagato: boolean;
  nota: string;
}

export interface Spesa {
  id: string;
  descrizione: string;
  importoTotale: number;
  data: string; // YYYY-MM-DD
  inseritoDa: string;
  iban?: string; // facoltativo: dove versare la quota
  ibanNome?: string; // a chi appartiene l'IBAN (se diverso da chi ha inserito la spesa)
  pagamenti: Record<string, Pagamento>;
  createdAt?: number;
}

export interface SpeseConfig {
  partecipanti: string[];
  divisioneDefault: string;
}

export interface MembroFormazione {
  nome: string;
  ruolo: string;
}

export interface SchedaTecnica {
  bandNome: string;
  aggiornato: string | null;
  formazione: MembroFormazione[];
  stagePlot: { descrizione: string; immagineUrl: string };
  backline: { voce?: string; batteria: string; basso: string; chitarre: string; tastiere: string; altro: string };
  audio: { canaliRichiesti: string; microfoniRichiesti: string; monitoraggio: string; note: string };
  luci: { richiesteSpeciali: string; note: string };
  visualsProiezioni: { requisitiTecnici: string; schermoMinimo: string; note: string };
  alimentazioneElettrica: { potenzaRichiesta: string; note: string };
  tempi: { montaggio: string; soundcheck: string; smontaggio: string };
  noteGenerali: string;
}

export interface RigaScaletta {
  id: string;
  /** "sezione" = intestazione (es. BIS, ALTRE) o, se senza titolo, uno stacco tra blocchi. */
  tipo: "brano" | "sezione";
  titolo: string;
  colore: string; // chiave di COLORI_RIGA, "" = nessuno
}

export interface NuovoPezzo {
  id: string;
  titolo: string;
  creato: string;
}

/** Documento scalette/live oppure scalette/{MEMBRO}. */
export interface ScalettaDoc {
  id: string;
  righe?: RigaScaletta[];
  aggiornato?: string | null;
  origine?: string; // solo per "live": da quale proposta è stata copiata
  nuoviPezzi?: NuovoPezzo[];
}

/** Data presa (concerto confermato). */
export interface DataPresa {
  id: string;
  data: string; // YYYY-MM-DD
  locale: string;
  indirizzo: string;
  cachet: number | null; // € concordati
  service: boolean; // service audio/luci fornito dal locale/organizzatore
  referente: string;
  presaDa: string;
  createdAt?: number;
}
