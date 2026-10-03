# Ondasonica Manager

Web app mobile-first della band **Ondasonica** (tributo ai Subsonica) per gestire la stagione 2027:
lead di locali/festival, attività, spese condivise e scheda tecnica.

> ⚠️ **ATTENZIONE — NESSUN LOGIN.** Chiunque abbia il link dell'app può vedere **e modificare** tutti i dati
> (lead, note, spese, scheda tecnica). Condividi il link **solo con le persone fidate** della band.
> Non inserire dati sensibili (IBAN, password, documenti).

## Sezioni

| Sezione | Cosa fa |
|---|---|
| **Home** | Colpo d'occhio: % lead contattati, lead per priorità e per stato, attività aperte, spese da saldare, link ai documenti (strategia, EPK, template email). |
| **Locali** | I 61 lead come card (tap per espandere). Filtri per priorità, regione, tipo, stato + ricerca libera. Modificabili: stato contatto, data ultimo contatto, note. Su schermi larghi c'è anche la vista **Tabella**. |
| **Attività** | Log/checklist ordinato per data. Aggiungi attività, cambia stato, modifica descrizione/note, elimina. |
| **Spese** | Nuova spesa (descrizione, importo, data, chi l'ha inserita) → quota a testa calcolata su 5. Per ogni partecipante toggle pagato/non pagato + nota. Riepilogo "quanto deve ancora versare ciascuno". |
| **Scheda tecnica** | Form a sezioni che rispecchia `data/scheda_tecnica.json`, salvataggio automatico campo per campo. |

Tutto si salva da solo (i campi di testo ~1 secondo dopo che smetti di scrivere, o quando esci dal campo) e
compare **in tempo reale** sugli altri telefoni. Su Android un piccolo "tick" di vibrazione conferma i
salvataggi (su iPhone Safari la vibrazione non è supportata: semplicemente non succede nulla).
Si può passare da una sezione all'altra anche con lo **swipe** orizzontale.

Consiglio: dal telefono, menu del browser → **"Aggiungi a schermata Home"** per usarla come un'app.

## Scelte tecniche (e perché)

- **Vite + React + TypeScript** — la soluzione più semplice per una app solo client: build statica, deploy
  gratuito su Vercel/Netlify senza server da gestire. Next.js non serve perché non ci sono API proprie.
- **Firebase Firestore** — persistenza condivisa con sync realtime (`onSnapshot`) tra più telefoni, free tier
  più che sufficiente per 5 persone. È attiva anche la cache offline: l'app si apre con rete scarsa e le
  modifiche fatte offline vengono inviate appena torna la connessione.
- **Nessuna autenticazione** (come richiesto). Le regole in `firestore.rules` permettono lettura/scrittura
  solo sulle collezioni usate dall'app (`leads`, `attivita`, `spese`, `config`) e bloccano tutto il resto.
- Stati attività: oltre a "Da fare / In corso / Completata" è mantenuto anche **"Da completare"**, perché è già
  usato nei dati di partenza (bozza EPK) — non è stato convertito silenziosamente.
- Spese: la divisione è sempre equa sui partecipanti in `config/spese` (SBERLA, CEKKO, ADRY, VALTER, PHIL),
  arrotondata al centesimo. Chi inserisce la spesa non viene segnato automaticamente come "pagato".
- Formazione (scheda tecnica): il JSON originale ha `formazione: []`; ogni membro è salvato come
  `{ nome, ruolo }`.
- Quando un lead passa da "Da contattare" a un altro stato e non ha una data, viene proposta la data di oggi.
- I documenti in `docs/*.md` sono visualizzati in sola lettura nella sezione Documenti (dalla Home).

## Struttura

```
data/            seed iniziale (leads, attività, spese, scheda tecnica)
docs/            strategia, EPK, template email (sola lettura nell'app)
scripts/seed.ts  import una tantum dei dati in Firestore
src/             codice dell'app
firestore.rules  regole di sicurezza da pubblicare su Firebase
```

Modello dati Firestore: `leads/{id}`, `attivita/{id}`, `spese/{id}`, `config/spese`,
`config/schedaTecnica`, `config/seed` (marcatore "seed già eseguito").

---

## 1. Creare il progetto Firebase (una volta, ~5 minuti)

1. Vai su <https://console.firebase.google.com> → **Aggiungi progetto** (es. `ondasonica-manager`).
   Google Analytics non serve.
2. Menu a sinistra **Build → Firestore Database → Crea database**. Scegli la località
   `eur3 (europe-west)` o `europe-west8 (Milano)`, modalità **produzione**.
3. Nella scheda **Regole** di Firestore incolla il contenuto del file [`firestore.rules`](firestore.rules)
   e premi **Pubblica**. (Importante: le regole "modalità test" scadono dopo 30 giorni.)
4. **Impostazioni progetto** (ingranaggio) → **Le tue app** → icona **`</>` (Web)** → dai un nome
   (es. `manager`), *non* serve Firebase Hosting → **Registra app**.
5. Ti viene mostrato un blocco `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`.
   Copia `.env.example` in `.env` e incolla i valori:

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=ondasonica-manager.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=ondasonica-manager
   VITE_FIREBASE_STORAGE_BUCKET=ondasonica-manager.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
   ```

   (Queste chiavi web non sono segrete in senso stretto — finiscono comunque nel codice del sito — ma
   è meglio non pubblicarle in giro: chi le ha può scrivere nel database.)

## 2. Girare in locale

Serve **Node.js 20+**.

```bash
cd manager
npm install
npm run dev          # apre su http://localhost:5173 (anche da telefono sulla stessa Wi-Fi: usa l'IP mostrato)
```

## 3. Importare i dati la prima volta (seed)

Dopo aver creato `.env` e pubblicato le regole:

```bash
npm run seed
```

Carica in Firestore i 61 lead, le attività, la configurazione spese e la scheda tecnica vuota.
**Va eseguito una sola volta**: se il database è già popolato lo script si ferma da solo, così non
sovrascrive le modifiche fatte dalla band. Non è collegato al deploy.

Per reimportare tutto da zero (⚠️ **cancella** stati, note e date inseriti nell'app su lead/attività/scheda;
le spese aggiunte nell'app non vengono toccate):

```bash
npm run seed:force
```

## 4. Deploy su Vercel (consigliato)

1. Vai su <https://vercel.com> → accedi con GitHub → **Add New → Project** → importa il repository.
2. **Root Directory: `manager`** (importante: l'app sta in questa sottocartella). Framework: Vite
   (rilevato in automatico; build `npm run build`, output `dist`).
3. In **Environment Variables** aggiungi le 6 variabili `VITE_FIREBASE_*` con gli stessi valori del `.env`
   (non aggiungere `VITE_FIRESTORE_EMULATOR`).
4. **Deploy**. Otterrai un indirizzo tipo `https://ondasonica-manager.vercel.app` (il nome si cambia in
   Settings → Domains). Quello è il link da girare alla band.

Ogni push sul branch principale rifà il deploy automaticamente. Se cambi le variabili d'ambiente serve un
nuovo deploy (Deployments → ⋯ → Redeploy).

### In alternativa: Netlify

**Add new site → Import an existing project** → repository → *Base directory* `manager`
(build `npm run build`, publish `dist` sono già in `netlify.toml`) → aggiungi le 6 variabili in
*Site configuration → Environment variables* → Deploy.

## Sviluppo con emulatore (opzionale)

Per provare senza toccare i dati veri: installa `firebase-tools`, avvia
`firebase emulators:start --only firestore --project demo-ondasonica` e in `.env.local` metti
`VITE_FIRESTORE_EMULATOR=localhost:8080` (più valori finti per le altre variabili, con
`VITE_FIREBASE_PROJECT_ID=demo-ondasonica`). `npm run seed` e `npm run dev` useranno l'emulatore.

## Modificare i dati "di ricerca"

Nome, tipo, comune, regione, periodo, genere, contatto, note di ricerca e fonte dei lead sono di sola lettura
nell'app. Per correggerli: modifica il documento direttamente dalla console Firebase (Firestore → `leads`),
oppure aggiorna `data/leads.json` e — solo se va bene perdere stati/note inseriti — `npm run seed:force`.
