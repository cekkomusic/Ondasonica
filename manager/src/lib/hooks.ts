import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface Live<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/** Collezione Firestore in tempo reale (onSnapshot). */
export function useCollection<T extends { id: string }>(name: string): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: true, error: null });
  useEffect(
    () =>
      onSnapshot(
        collection(db(), name),
        (snap) => {
          // Su un dispositivo nuovo la prima risposta arriva dalla cache vuota: aspetta il server
          // invece di mostrare "vuoto" (che poteva far ricreare dati già esistenti).
          if (snap.empty && snap.metadata.fromCache) return;
          setState({
            data: snap.docs.map((d) => ({ ...(d.data() as Omit<T, "id">), id: d.id }) as T),
            loading: false,
            error: null,
          });
        },
        (err) => setState((s) => ({ ...s, loading: false, error: err.message })),
      ),
    [name],
  );
  return state;
}

/** Singolo documento Firestore in tempo reale. */
export function useDocument<T>(path: string, id: string): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: true, error: null });
  useEffect(
    () =>
      onSnapshot(
        doc(db(), path, id),
        (snap) => {
          // "Non esiste" letto solo dalla cache locale non è affidabile: aspetta la conferma del server.
          if (!snap.exists() && snap.metadata.fromCache) return;
          setState({ data: snap.exists() ? (snap.data() as T) : null, loading: false, error: null });
        },
        (err) => setState((s) => ({ ...s, loading: false, error: err.message })),
      ),
    [path, id],
  );
  return state;
}
