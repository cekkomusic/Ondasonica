import type { FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

/**
 * Le regole del database ammettono solo chi ha fatto l'accesso con l'account della band.
 * Gli script entrano con la stessa password dell'app, letta da ONDASONICA_PASSWORD
 * (mai scritta nel codice). Con l'emulatore non serve.
 */
export async function accedi(app: FirebaseApp) {
  if (process.env.VITE_FIRESTORE_EMULATOR) return;
  const password = process.env.ONDASONICA_PASSWORD;
  if (!password) {
    console.error("✗ Imposta la password della band: ONDASONICA_PASSWORD='…' npm run …");
    process.exit(1);
  }
  const email = process.env.VITE_APP_LOGIN_EMAIL || "band@ondasonica.app";
  await signInWithEmailAndPassword(getAuth(app), email, password);
}
