import type { SchedaTecnica } from "./types";

export type Sezione = Exclude<keyof SchedaTecnica, "bandNome" | "aggiornato" | "formazione" | "noteGenerali">;

// Etichette leggibili per i campi esistenti (la struttura dati resta quella di data/scheda_tecnica.json).
export const SEZIONI: { key: Sezione; titolo: string; icona: string; campi: Record<string, { label: string; hint?: string; multi?: boolean }> }[] = [
  {
    key: "stagePlot",
    titolo: "Stage plot",
    icona: "🗺️",
    campi: {
      descrizione: { label: "Disposizione sul palco", hint: "Chi sta dove, pedane, ingombri…", multi: true },
      immagineUrl: { label: "Link immagine stage plot", hint: "https://… (Drive, Dropbox, ecc.)" },
    },
  },
  {
    key: "backline",
    titolo: "Backline",
    icona: "🥁",
    campi: {
      batteria: { label: "Batteria", multi: true },
      basso: { label: "Basso", multi: true },
      chitarre: { label: "Chitarre", multi: true },
      tastiere: { label: "Tastiere / synth", multi: true },
      altro: { label: "Altro", multi: true },
    },
  },
  {
    key: "audio",
    titolo: "Audio",
    icona: "🎚️",
    campi: {
      canaliRichiesti: { label: "Canali richiesti", hint: "Es. 24 canali + input list" },
      microfoniRichiesti: { label: "Microfoni richiesti", multi: true },
      monitoraggio: { label: "Monitoraggio", hint: "In-ear / spie, quante linee…", multi: true },
      note: { label: "Note audio", multi: true },
    },
  },
  {
    key: "luci",
    titolo: "Luci",
    icona: "💡",
    campi: {
      richiesteSpeciali: { label: "Richieste speciali", multi: true },
      note: { label: "Note luci", multi: true },
    },
  },
  {
    key: "visualsProiezioni",
    titolo: "Visuals / proiezioni",
    icona: "📽️",
    campi: {
      requisitiTecnici: { label: "Requisiti tecnici", hint: "Proiettore, ledwall, connessioni…", multi: true },
      schermoMinimo: { label: "Schermo minimo", hint: "Es. 4×3 m" },
      note: { label: "Note visuals", multi: true },
    },
  },
  {
    key: "alimentazioneElettrica",
    titolo: "Alimentazione elettrica",
    icona: "⚡",
    campi: {
      potenzaRichiesta: { label: "Potenza richiesta", hint: "Es. 6 kW, 2 linee separate" },
      note: { label: "Note alimentazione", multi: true },
    },
  },
  {
    key: "tempi",
    titolo: "Tempi",
    icona: "⏱️",
    campi: {
      montaggio: { label: "Montaggio", hint: "Es. 60 min" },
      soundcheck: { label: "Soundcheck", hint: "Es. 45 min" },
      smontaggio: { label: "Smontaggio", hint: "Es. 40 min" },
    },
  },
];

