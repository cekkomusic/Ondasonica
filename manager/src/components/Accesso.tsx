import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth, EMAIL_ACCESSO } from "../lib/firebase";
import { Loading } from "./States";

/** Mostra l'app solo dopo aver inserito la password della band (una volta per dispositivo). */
export function Accesso({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth(), setUtente), []);

  if (utente === undefined) return <Loading />;
  if (!utente) return <SchermataPassword />;
  return <>{children}</>;
}

/** Esce dall'app: questo telefono smette anche di ricevere i promemoria. */
export async function esci() {
  try {
    const { disattivaNotifiche } = await import("../lib/notifiche");
    await disattivaNotifiche();
  } catch {
    /* se fallisce si esce comunque */
  }
  await signOut(auth());
}

function messaggio(code: string) {
  if (["auth/invalid-credential", "auth/wrong-password", "auth/invalid-login-credentials", "auth/user-not-found"].includes(code))
    return "Password sbagliata.";
  if (code === "auth/too-many-requests") return "Troppi tentativi: aspetta qualche minuto e riprova.";
  if (code === "auth/network-request-failed") return "Nessuna connessione: controlla internet e riprova.";
  if (code === "auth/operation-not-allowed") return "Accesso con password non ancora attivato su Firebase.";
  return "Accesso non riuscito, riprova.";
}

function SchermataPassword() {
  const [password, setPassword] = useState("");
  const [vedi, setVedi] = useState(false);
  const [errore, setErrore] = useState("");
  const [attesa, setAttesa] = useState(false);

  const entra = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setAttesa(true);
    setErrore("");
    try {
      await signInWithEmailAndPassword(auth(), EMAIL_ACCESSO, password);
    } catch (err) {
      setErrore(messaggio((err as { code?: string }).code ?? ""));
      setAttesa(false);
    }
  };

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />
      <main className="accesso">
        <img src="/logo.png" alt="OndaSonicA" className="accesso-logo" />
        <h1>Ondasonica Manager</h1>
        <p className="muted">Inserisci la password della band per entrare.</p>
        <form onSubmit={entra} className="card accesso-form">
          <div className="accesso-campo">
            <input
              className="input"
              type={vedi ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="button" className="btn sm" onClick={() => setVedi(!vedi)} aria-label={vedi ? "Nascondi password" : "Mostra password"}>
              {vedi ? "🙈" : "👁"}
            </button>
          </div>
          {errore && <p className="accesso-errore">{errore}</p>}
          <button type="submit" className="btn primary block" disabled={!password || attesa}>
            {attesa ? "Accesso…" : "Entra"}
          </button>
        </form>
        <p className="small muted">La password va inserita una sola volta su ogni telefono o computer.</p>
      </main>
    </div>
  );
}
