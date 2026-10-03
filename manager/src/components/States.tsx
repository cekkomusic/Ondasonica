export function Loading() {
  return (
    <div className="center-state">
      <div className="pulse-wave" aria-label="Caricamento">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="page">
      <div className="card error-box">
        <h3>Impossibile leggere i dati</h3>
        <p className="small">{msg}</p>
        <p className="small muted">
          Controlla le regole di sicurezza di Firestore (file firestore.rules) e che lo script di seed sia stato eseguito.
        </p>
      </div>
    </div>
  );
}
