# OndaSonicA – progetto della band (per Claude)

OndaSonicA è una **tribute band dei Subsonica di Torino**. Il gestore del progetto è CEKKO. Non è un programmatore e scrive in italiano.
**Rispondi sempre in italiano.** Scrivi istruzioni chiare e numerate, con i link esatti da cliccare: a CEKKO non piacciono le spiegazioni confuse.
Il progetto deve restare **a costo zero**: non proporre servizi a pagamento senza chiedere, perché in passato una proposta così è stata rifiutata.

## Cosa c'è nel repository
- `manager/` è la **web app "Ondasonica Manager"**, pubblicata su https://ondasonica-manager.vercel.app (Vercel, deploy automatico da `main`).
  - Esiste anche come **APK Android** (TWA: `public/.well-known/assetlinks.json`) e su **iPhone** si installa con Safari → Condividi → "Aggiungi a schermata Home".
  - Stack: Vite + React 19 + TypeScript, react-router v7 (BrowserRouter, rotte lazy), Firebase Firestore (client SDK v12, cache persistente, hook `useCollection`/`useDocument` in `src/lib/hooks.ts`), Firebase Auth, Firebase Cloud Messaging.
  - Firebase Storage **non** si usa, perché richiede il piano Blaze: le foto sono documenti `config/foto-*` in dataURL di al massimo ~800KB.
  - Funzioni server Vercel in `manager/api/*.ts` (firma Web `GET/POST(request)`, import `./_lib.js`): `promemoria` (cron 7:00 e 8:00 UTC, vedi `vercel.json`), `test-notifica`, `estrai-contatti` (legge una pagina web ed estrae email, telefoni e social), `immagine` (proxy immagini).
  - Script in `manager/scripts/` (`seed`, `importa-contatti`, `rimuovi-email`): richiedono `ONDASONICA_PASSWORD`.
- `ricerche/` contiene le **liste di contatti** (JSON da incollare nell'app in Locali → Trova nuovi locali → 📋 Importa lista, e TXT di email):
  - `TUTTI-locali.json` (226 locali e festival);
  - `PROLOCO-TUTTE.json` / `PROLOCO-EMAIL.txt` (Pro Loco già usate);
  - `mappatura-2026-10-21/` (541 email di Pro Loco **mai contattate**: Piemonte, Trentino, Toscana);
  - `GMAIL-GIA-CONTATTATI.txt` (2060 indirizzi a cui la Gmail della band ha già scritto: escludili sempre dalle nuove mappature);
  - `EMAIL-RIMBALZATE.txt` (indirizzi non validi: escludili);
  - `GMAIL-INVII-MASSIVI.txt` (invii in Ccn dell'8–16 ottobre 2026).
- `manager/docs/` contiene strategia, EPK e template email. `ondasonica-sito.html` è il sito vetrina.

## Sezioni dell'app
- Barra in basso: Home, Locali, Concerti, Calendario, Scaletta, Spese, Scheda.
- Altre pagine: Demo, Booking, Documenti, Attività (dalla Home) e Trova locali (`/locali/trova`).
- Funzioni principali:
  - **Locali**: filtri, tasto "Estrai tutte le email" (in pacchetti da 50/100/200/500, formato `email; `) e blocco note condiviso "📝 Trattative in corso" (`config/trattative`).
  - **Calendario**: impegni per persona, BAND (prove, passaggio locale, videocall, telefonata), notifiche push alle 9:00.
  - **Spese**: quote divise in parti uguali, rubrica IBAN.
  - **Scaletta**: ufficiale e personale, link a testo e YouTube.
  - **Scheda tecnica**: esportazione in PDF/JPG e condivisione.

## Accesso e sicurezza
- All'apertura l'app chiede la **password della band** (componente `src/components/Accesso.tsx`). È un login Firebase Auth con un unico account condiviso, `ondasonicatorino@gmail.com`; la password la conosce la band.
- **Non scrivere mai la password nel codice, nei commit o nei file.**
- `manager/firestore.rules`: tutte le collezioni richiedono `request.auth != null`. Le regole vanno incollate a mano in Firebase Console → Firestore → Regole.
- Le **notifiche** arrivano solo ai dispositivi registrati da utenti autenticati (campo `uid` in `config/notifiche.dispositivi`).
- Non chiedere mai a CEKKO il file JSON dell'account di servizio Firebase: sta solo nelle variabili di Vercel (`FIREBASE_SERVICE_ACCOUNT`).

## Formazione (novembre 2026)
- Partecipanti: **SBERLA, CEKKO, GIULIO, VALTER, PHIL**. Crew in calendario: **SILVANO**.
- GIULIO ha preso il posto di ADRY: le quote delle spese e la scaletta personale sono state migrate da `src/lib/migrazioni.ts`.
- Calendario e concerti **restano a nome di ADRY e FABRIZIO** e si mostrano come "ex". MATTEO e FABRIZIO non sono più selezionabili.

## Servizi esterni (fuori da GitHub, restano invariati cambiando account Claude)
- **Firebase**: progetto della band (Firestore, Auth, Cloud Messaging).
- **Vercel**: progetto `ondasonica-manager` del team `cekko1`. Variabili: `VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `CRON_SECRET`.
- **Gmail della band**: ondasonicatorino@gmail.com. Si può collegare come connettore per leggere risposte e rimbalzi; **non inviare mai email senza conferma**.

## Come lavorare
- Le modifiche passano da branch e **pull request** su GitHub (`cekkomusic/Ondasonica`). CEKKO le unisce con "Merge pull request". Dopo ogni merge Vercel aggiorna l'app in 1–2 minuti.
- Prima di consegnare prova sempre:
  - `cd manager && npm ci && npx tsc -b && npm run build`;
  - quando serve, prova con emulatori Firestore + Auth e Playwright.
- Per le ricerche di email (Pro Loco, locali): non inventare mai indirizzi, escludi le PEC e confronta sempre con `GMAIL-GIA-CONTATTATI.txt` ed `EMAIL-RIMBALZATE.txt`.
