import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { tick } from "../lib/haptics";

type Kind = "ok" | "err";
interface ToastState {
  msg: string;
  kind: Kind;
  key: number;
}

const Ctx = createContext<(p: Promise<unknown>, msg?: string) => void>(() => {});

/**
 * save(promise) mostra "Salvato" (con tick aptico) quando la scrittura
 * è confermata da Firestore, o un errore se fallisce.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((msg: string, kind: Kind) => {
    window.clearTimeout(timer.current);
    setToast({ msg, kind, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), kind === "err" ? 4000 : 1400);
  }, []);

  const save = useCallback(
    (p: Promise<unknown>, msg = "Salvato") => {
      tick();
      p.then(
        () => show(msg, "ok"),
        (e: Error) => {
          tick([30, 60, 30]);
          show(`Errore: ${e.message}`, "err");
        },
      );
    },
    [show],
  );

  return (
    <Ctx.Provider value={save}>
      {children}
      {toast && (
        <div key={toast.key} className={`toast toast-${toast.kind}`} role="status">
          {toast.kind === "ok" ? "✓ " : ""}
          {toast.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useSave = () => useContext(Ctx);
