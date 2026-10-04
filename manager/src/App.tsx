import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { firebaseConfigured } from "./lib/firebase";
import { ToastProvider } from "./components/Toast";
import { Loading } from "./components/States";
import { tick } from "./lib/haptics";

const Home = lazy(() => import("./pages/Home"));
const Leads = lazy(() => import("./pages/Leads"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Attivita = lazy(() => import("./pages/Attivita"));
const Spese = lazy(() => import("./pages/Spese"));
const Scheda = lazy(() => import("./pages/Scheda"));
const Scaletta = lazy(() => import("./pages/Scaletta"));
const DatePrese = lazy(() => import("./pages/Date"));
const Documenti = lazy(() => import("./pages/Documenti"));

const NAV = [
  { to: "/", label: "Home", icon: <IconHome /> },
  { to: "/locali", label: "Locali", icon: <IconPin /> },
  { to: "/concerti", label: "Concerti", icon: <IconMic /> },
  { to: "/calendario", label: "Calendario", icon: <IconCalendar /> },
  { to: "/scaletta", label: "Scaletta", icon: <IconMusic /> },
  { to: "/spese", label: "Spese", icon: <IconEuro /> },
  { to: "/scheda", label: "Scheda", icon: <IconSliders /> },
];

export default function App() {
  if (!firebaseConfigured) return <SetupScreen />;
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const idx = NAV.findIndex((n) => (n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to)));
  const prevIdx = useRef(idx);
  const dir = idx >= prevIdx.current ? "fwd" : "back";
  useEffect(() => {
    prevIdx.current = idx;
    window.scrollTo({ top: 0 });
  }, [idx, location.pathname]);

  useSwipeNav((delta) => {
    if (idx < 0) return;
    const next = idx + delta;
    if (next >= 0 && next < NAV.length) {
      tick(8);
      navigate(NAV[next].to);
    }
  });

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />
      <main key={location.pathname} className={`view view-${dir}`}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/locali" element={<Leads />} />
            <Route path="/attivita" element={<Attivita />} />
            <Route path="/spese" element={<Spese />} />
            <Route path="/scheda" element={<Scheda />} />
            <Route path="/scaletta" element={<Scaletta />} />
            <Route path="/concerti" element={<DatePrese />} />
            <Route path="/date" element={<DatePrese />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/documenti" element={<Documenti />} />
            <Route path="/documenti/:id" element={<Documenti />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className="nav-item" onClick={() => tick(6)}>
            {n.icon}
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/**
 * Swipe orizzontale per passare alla sezione accanto.
 * Ignorato su campi di testo, select, liste scorrevoli orizzontali ([data-noswipe]) e tabelle.
 */
function useSwipeNav(onSwipe: (delta: 1 | -1) => void) {
  const cb = useRef(onSwipe);
  cb.current = onSwipe;
  useEffect(() => {
    let x0 = 0,
      y0 = 0,
      t0 = 0,
      active = false;
    const start = (e: TouchEvent) => {
      const el = e.target as HTMLElement;
      active =
        e.touches.length === 1 &&
        !el.closest("input, textarea, select, [data-noswipe], .table-wrap, .segmented, .debt-grid");
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    };
    const end = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Date.now() - t0 < 600 && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) onSwipeDir(dx < 0 ? 1 : -1);
    };
    const onSwipeDir = (d: 1 | -1) => cb.current(d);
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchend", end);
    };
  }, []);
}

function SetupScreen() {
  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />
      <main className="page">
        <header className="hero">
          <h1 className="brand">
            Onda<span>sonica</span>
          </h1>
        </header>
        <div className="card">
          <h3>Configurazione mancante</h3>
          <p className="small">
            Le chiavi di Firebase non sono impostate. Copia <code>.env.example</code> in <code>.env</code>, incolla i valori del
            tuo progetto Firebase e riavvia (in locale) o aggiungi le variabili <code>VITE_FIREBASE_*</code> nelle impostazioni
            di Vercel/Netlify e rifai il deploy. Istruzioni complete nel README.
          </p>
        </div>
      </main>
    </div>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
function IconHome() {
  return (
    <Svg>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
    </Svg>
  );
}
function IconPin() {
  return (
    <Svg>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Svg>
  );
}
function IconMic() {
  return (
    <Svg>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </Svg>
  );
}
function IconCalendar() {
  return (
    <Svg>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" />
    </Svg>
  );
}
function IconMusic() {
  return (
    <Svg>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </Svg>
  );
}
function IconEuro() {
  return (
    <Svg>
      <path d="M17 6.5A6.5 6.5 0 1 0 17 17.5" />
      <path d="M4.5 10.5h9M4.5 13.5h9" />
    </Svg>
  );
}
function IconSliders() {
  return (
    <Svg>
      <path d="M6 4v16M12 4v16M18 4v16" />
      <rect x="4" y="13" width="4" height="3" rx="1" fill="currentColor" />
      <rect x="10" y="7" width="4" height="3" rx="1" fill="currentColor" />
      <rect x="16" y="15" width="4" height="3" rx="1" fill="currentColor" />
    </Svg>
  );
}
