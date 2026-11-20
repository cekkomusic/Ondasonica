import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

export function app(): FirebaseApp {
  if (!_app) _app = initializeApp(config);
  return _app;
}

export function db(): Firestore {
  if (!_db) {
    const app_ = app();
    // Cache locale: l'app si apre subito anche con rete scarsa e le modifiche
    // fatte offline vengono sincronizzate appena torna la connessione.
    _db = initializeFirestore(app_, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    // Solo per sviluppo/test locale con l'emulatore Firestore (es. "localhost:8080").
    const emu = import.meta.env.VITE_FIRESTORE_EMULATOR as string | undefined;
    if (emu) {
      const [host, port] = emu.split(":");
      connectFirestoreEmulator(_db, host, Number(port));
    }
  }
  return _db;
}

/**
 * Accesso all'app: un unico account condiviso della band (Firebase Authentication,
 * email + password). L'utente scrive solo la password; l'email è fissa.
 * La password NON è nel codice: la verifica Firebase.
 */
export const EMAIL_ACCESSO = (import.meta.env.VITE_APP_LOGIN_EMAIL as string | undefined) || "band@ondasonica.app";

let _auth: Auth | null = null;

export function auth(): Auth {
  if (!_auth) {
    _auth = getAuth(app());
    // Solo per test locale con l'emulatore di Firebase Auth (es. "localhost:9099").
    const emu = import.meta.env.VITE_AUTH_EMULATOR as string | undefined;
    if (emu) connectAuthEmulator(_auth, `http://${emu}`, { disableWarnings: true });
  }
  return _auth;
}
