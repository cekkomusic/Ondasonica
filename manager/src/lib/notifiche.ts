import { doc, setDoc } from "firebase/firestore";
import { app, db } from "./firebase";

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const LS_ID = "ondasonica.notificheId";

export const notificheConfigurate = Boolean(VAPID);

export type StatoNotifiche = "non-supportate" | "ios-installa" | "negate" | "attive" | "disattive";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const leggiId = () => {
  try {
    return localStorage.getItem(LS_ID) ?? "";
  } catch {
    return "";
  }
};

export async function statoNotifiche(): Promise<StatoNotifiche> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return isIos() && !isStandalone() ? "ios-installa" : "non-supportate";
  }
  const { isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return isIos() && !isStandalone() ? "ios-installa" : "non-supportate";
  if (Notification.permission === "denied") return "negate";
  return Notification.permission === "granted" && leggiId() ? "attive" : "disattive";
}

/** Id breve e stabile ricavato dal token (chiave nel documento config/notifiche). */
function idDa(token: string) {
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (let i = 0; i < token.length; i++) {
    h1 = Math.imul(h1 ^ token.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ token.charCodeAt(token.length - 1 - i), 2246822519) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

async function registraToken(membro: string) {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const { getMessaging, getToken } = await import("firebase/messaging");
  const token = await getToken(getMessaging(app()), { vapidKey: VAPID, serviceWorkerRegistration: reg });
  if (!token) throw new Error("token non disponibile");
  const id = idDa(token);
  const vecchio = leggiId();
  const dispositivi: Record<string, unknown> = {
    [id]: { token, membro: membro || null, aggiornato: new Date().toISOString(), ua: navigator.userAgent.slice(0, 120) },
  };
  if (vecchio && vecchio !== id) {
    const { deleteField } = await import("firebase/firestore");
    dispositivi[vecchio] = deleteField();
  }
  await setDoc(doc(db(), "config", "notifiche"), { dispositivi }, { merge: true });
  try {
    localStorage.setItem(LS_ID, id);
  } catch {
    /* ignorato */
  }
  return id;
}

/** Chiede il permesso e registra questo telefono per i promemoria. */
export async function attivaNotifiche(membro: string) {
  if (!VAPID) throw new Error("notifiche non configurate (manca VITE_FIREBASE_VAPID_KEY)");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("permesso negato: abilita le notifiche nelle impostazioni del browser");
  return registraToken(membro);
}

/** All'apertura dell'app: se le notifiche sono già attive, rinnova il token (resta valido nel tempo). */
export async function rinnovaSeAttive(membro: string) {
  if (!VAPID || !("Notification" in window) || Notification.permission !== "granted" || !leggiId()) return;
  try {
    await registraToken(membro);
  } catch {
    /* silenzioso */
  }
}

export async function disattivaNotifiche() {
  const id = leggiId();
  if (id) {
    const { deleteField } = await import("firebase/firestore");
    await setDoc(doc(db(), "config", "notifiche"), { dispositivi: { [id]: deleteField() } }, { merge: true });
  }
  try {
    const { getMessaging, deleteToken } = await import("firebase/messaging");
    await deleteToken(getMessaging(app()));
  } catch {
    /* ignorato */
  }
  try {
    localStorage.removeItem(LS_ID);
  } catch {
    /* ignorato */
  }
}

export async function inviaProva() {
  const id = leggiId();
  const r = await fetch("/api/test-notifica", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  const j = (await r.json().catch(() => ({}))) as { errore?: string };
  if (!r.ok) throw new Error(j.errore || `errore ${r.status}`);
}
