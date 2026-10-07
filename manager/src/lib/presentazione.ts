/** Dati delle sezioni Demo (video YouTube) e Booking (presentazione, contatti, foto ufficiali). */
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, documentId, getDocs, query, setDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { useDocument } from "./hooks";

const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Demo ---------- */

export interface VideoDemo {
  id: string;
  titolo: string;
  url: string;
  ytId: string;
}

/** Estrae l'id del video da qualsiasi link YouTube (watch, youtu.be, shorts, live, embed). */
export function ytId(link: string): string {
  const t = link.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1, 12);
    if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(?:shorts|live|embed|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* link non valido */
  }
  return "";
}

const refDemo = () => doc(db(), "config", "demo");

export function useDemo() {
  const d = useDocument<{ video?: VideoDemo[] }>("config", "demo");
  return { video: d.data?.video ?? [], loading: d.loading };
}

export const aggiungiVideo = (url: string, titolo: string) => {
  const id = ytId(url);
  if (!id) return Promise.reject(new Error("link YouTube non riconosciuto"));
  const v: VideoDemo = { id: nuovoId(), titolo: titolo.trim(), url: `https://www.youtube.com/watch?v=${id}`, ytId: id };
  return setDoc(refDemo(), { video: arrayUnion(v) }, { merge: true });
};

export const salvaListaVideo = (video: VideoDemo[]) => setDoc(refDemo(), { video }, { merge: true });
export const rimuoviVideo = (v: VideoDemo) => setDoc(refDemo(), { video: arrayRemove(v) }, { merge: true });

/* ---------- Booking ---------- */

export interface InfoBooking {
  presentazione?: string;
  contattoNome?: string;
  contattoTelefono?: string;
  contattoEmail?: string;
  social?: string;
  foto?: { id: string; titolo: string; w: number; h: number }[];
}

export const useBooking = () => useDocument<InfoBooking>("config", "booking");
export const salvaBooking = (campi: Partial<InfoBooking>) => setDoc(doc(db(), "config", "booking"), campi, { merge: true });

/**
 * Le foto sono salvate compresse (JPEG, lato lungo max 1600 px, < ~600 KB) ciascuna in un documento
 * config/foto-<id>, perché Firestore accetta documenti fino a 1 MB e Firebase Storage richiede il piano a pagamento.
 */
export async function comprimiFoto(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  const bmp = await createImageBitmap(file).catch(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img;
  });
  const sw = "width" in bmp ? bmp.width : 0;
  const sh = "height" in bmp ? bmp.height : 0;
  for (const [lato, q] of [
    [1600, 0.82],
    [1600, 0.7],
    [1280, 0.72],
    [1024, 0.7],
  ] as const) {
    const scala = Math.min(1, lato / Math.max(sw, sh));
    const w = Math.round(sw * scala);
    const h = Math.round(sh * scala);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(bmp as CanvasImageSource, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", q);
    if (dataUrl.length < 800_000) return { dataUrl, w, h };
  }
  throw new Error("foto troppo pesante anche dopo la compressione");
}

export async function caricaFoto(file: File, titolo: string) {
  const { dataUrl, w, h } = await comprimiFoto(file);
  const id = nuovoId();
  await setDoc(doc(db(), "config", `foto-${id}`), { dataUrl, titolo, w, h, caricata: new Date().toISOString() });
  await setDoc(doc(db(), "config", "booking"), { foto: arrayUnion({ id, titolo, w, h }) }, { merge: true });
}

export async function rimuoviFoto(id: string, attuali: NonNullable<InfoBooking["foto"]>) {
  await salvaBooking({ foto: attuali.filter((f) => f.id !== id) });
  await deleteDoc(doc(db(), "config", `foto-${id}`));
}

/** Carica i dati delle foto (una sola lettura per tutte). */
export function useFotoDati(ids: string[]) {
  const [dati, setDati] = useState<Record<string, string>>({});
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) return;
    let vivo = true;
    const q = query(collection(db(), "config"), where(documentId(), ">=", "foto-"), where(documentId(), "<", "foto-"));
    getDocs(q).then((snap) => {
      if (!vivo) return;
      const out: Record<string, string> = {};
      snap.forEach((d) => (out[d.id.slice(5)] = (d.data() as { dataUrl: string }).dataUrl));
      setDati(out);
    });
    return () => {
      vivo = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return dati;
}

export async function fileDaDataUrl(dataUrl: string, nome: string) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], nome, { type: blob.type || "image/jpeg" });
}
