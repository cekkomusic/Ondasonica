# Ondasonica Manager

Web app mobile-first della band **Ondasonica** (tributo ai Subsonica) per gestire la stagione 2027:
lead di locali/festival, attività, spese condivise e scheda tecnica.

> ⚠️ **ATTENZIONE — NESSUN LOGIN.** Chiunque abbia il link dell'app può vedere **e modificare** tutti i dati
> (lead, note, spese, date, scaletta, scheda tecnica). Condividi il link **solo con le persone fidate** della band.
> Non inserire password o documenti. Gli IBAN (sezione Spese) sono visibili a chiunque abbia il link: usateli solo tra di voi.

## Sezioni

| Sezione | Cosa fa |
|---|---|
| **Home** | Colpo d'occhio: % lead contattati, lead per priorità e per stato, attività aperte, spese da saldare, link ai documenti (strategia, EPK, template email). |
| **Locali** | I 61 lead come card (tap per espandere). Filtri per priorità, regione, tipo, stato + ricerca libera. Modificabili: stato contatto, data ultimo contatto, note. Su schermi larghi c'è anche la vista **Tabella**. |
| **Concerti** | Concerti confermati (ex "Date prese"): data, locale, indirizzo, cachet concordato, service sì/no, referente, presa da. Card con "In programma" / "Passate", tabella su schermi larghi, link a Maps. La prossima data compare in Home. |
| **Calendario** | Calendario mensile condiviso per i 5 membri più la crew (SILVANO e MATTEO, video e audio live): ognuno sceglie "Chi sei?", tocca un giorno, scrive cosa farà e può segnarsi **indisponibile** (in rosso), poi **Salva**. Nella griglia: pallino rosso = qualcuno indisponibile, pallino azzurro = impegno segnato, 🎸 = concerto. Quando si inserisce un nuovo concerto in un giorno in cui qualcuno è indisponibile, compare un avviso. Scegliendo **🎸 BAND** si segnano gli eventi del gruppo: **🥁 Prove** e **🤝 Passaggio locale** (con nota, es. orario e luogo), elencati sotto la griglia insieme ai concerti del mese. |
| **Scaletta** | Sotto-tab **Scaletta ufficiale** + una **Proposta** per ogni membro. Nella scaletta ufficiale l'ordine è di sola lettura (si cambiano solo i colori delle righe, toccando il numero); il tasto **+ Aggiungi brano** aggiunge un brano a tutte le scalette (ufficiale e proposte dei membri), come ultimo dei BIS. Nelle proposte personali: trascina ⠿ per spostare le righe, colori, aggiungi/togli brani e stacchi, poi **Salva** o **Rendi scaletta ufficiale** (copia la proposta nella scaletta ufficiale). Sotto ogni tab c'è il riquadro **Proposte nuovi pezzi**: nelle tab personali si scrive e si salva, sotto la scaletta ufficiale compare in automatico come "titolo proposta da NOME" (sola lettura). |
| **Attività** (dalla Home) | Log/checklist ordinato per data. Aggiungi attività, cambia stato, modifica descrizione/note, elimina. |
| **Spese** | Nuova spesa (descrizione, importo, data, chi l'ha inserita) → quota a testa calcolata su 5. Per ogni partecipante toggle pagato/non pagato + nota. Riepilogo "quanto deve ancora versare ciascuno". Campo **IBAN** facoltativo con tasto copia e **📒 Rubrica IBAN** (nome + IBAN, in `config/rubricaIban`) da cui pescare quando si inserisce una spesa. |
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
- Persone esterne: FABRIZIO compare solo in Concerti → "Presa da"; SILVANO e MATTEO (crew) solo nel Calendario. Nessuno dei tre entra nella divisione delle spese.
- Formazione (scheda tecnica): il JSON originale ha `formazione: []`; ogni membro è salvato come
  `{ nome, ruolo }`.
- Quando un lead passa da "Da contattare" a un altro stato e non ha una data, viene proposta la data di oggi.
- Scaletta: i brani sono numerati in automatico (quindi il doppio "17" della lista originale diventa 17-18);
  le righe "sezione" senza titolo sono gli stacchi tra blocchi, "BIS" e "ALTRE" sono intestazioni e i brani
  dopo "ALTRE" non sono numerati. Scaletta iniziale in `data/scaletta.json`.
- I documenti in `docs/*.md` sono visualizzati in sola lettura nella sezione Documenti (dalla Home).

## Struttura

```
data/            seed iniziale (leads, attività, spese, scheda tecnica)
docs/            strategia, EPK, template email (sola lettura nell'app)
scripts/seed.ts  import una tantum dei dati in Firestore
src/             codice dell'app
firestore.rules  regole di sicurezza da pubblicare su Firebase
```

Modello dati Firestore: `leads/{id}`, `attivita/{id}`, `spese/{id}`, `date/{id}`, `scalette/live`,
`scalette/{MEMBRO}` (proposta + nuovi pezzi), `config/calendario-YYYY-MM` (un documento per mese con gli
impegni di ciascuno; sta in `config` così non serve aggiornare le regole), `config/spese`,
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

## 3. Importare i dati la prima volta

**Modo più semplice (senza computer):** dopo il deploy (punto 4) apri il link dell'app. Se il database è vuoto
compare la schermata **"Database vuoto"** con il tasto **Importa dati iniziali**: premilo una volta e l'app
carica i 61 lead, le attività, la scaletta ufficiale, la configurazione spese e la scheda tecnica vuota.
Il tasto sparisce da solo quando i dati ci sono.

**In alternativa da computer** (dopo aver creato `.env` e pubblicato le regole):

```bash
npm run seed
```

Fa la stessa cosa del tasto. In entrambi i casi l'import avviene **una sola volta**: se il database è già
popolato si ferma, così non sovrascrive le modifiche fatte dalla band (unica eccezione dello script: se manca
la scaletta ufficiale, la aggiunge). Non è collegato al deploy.

Per reimportare tutto da zero (⚠️ **cancella** stati, note e date inseriti nell'app su lead/attività/scheda;
le spese aggiunte nell'app non vengono toccate):

```bash
npm run seed:force
```

> Se avevi già pubblicato le regole prima dell'aggiunta di Scaletta e Date prese, ripubblica `firestore.rules`
> (ora include anche `scalette` e `date`), altrimenti quelle sezioni non riescono a salvare.

## 4. Deploy su Vercel (consigliato)

0. Il codice dell'app deve stare sul branch principale (`main`) del repository: Vercel pubblica quello.
   Se l'app è ancora su un altro branch, uniscila a `main` (su GitHub: **Pull requests → New pull request**,
   scegli il branch dell'app → **Create pull request → Merge pull request**).
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
