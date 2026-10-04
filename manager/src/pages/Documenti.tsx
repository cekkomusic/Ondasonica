import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { marked } from "marked";
import strategia from "../../docs/strategia-procacciamento-2027.md?raw";
import epk from "../../docs/epk-ondasonica.md?raw";
import email from "../../docs/email-outreach-templates.md?raw";

// Documenti di sola lettura (contesto del lavoro fatto). Si modificano nei file docs/*.md.
const DOCS: Record<string, { titolo: string; md: string }> = {
  strategia: { titolo: "Strategia procacciamento 2027", md: strategia },
  epk: { titolo: "EPK / presentazione (bozza)", md: epk },
  email: { titolo: "Template email", md: email },
};

const stripFrontmatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n/, "");

export default function Documenti() {
  const { id } = useParams();
  const d = id ? DOCS[id] : undefined;
  const html = useMemo(() => (d ? (marked.parse(stripFrontmatter(d.md)) as string) : ""), [d]);

  if (!d)
    return (
      <div className="page">
        <header className="page-head">
          <h1>Documenti</h1>
          <p className="muted">Materiale di riferimento (sola lettura)</p>
        </header>
        <div className="list">
          {Object.entries(DOCS).map(([k, v]) => (
            <Link key={k} to={`/documenti/${k}`} className="card doc-link">
              <span>📄</span>
              <strong className="grow">{v.titolo}</strong>
              <span>→</span>
            </Link>
          ))}
        </div>
      </div>
    );

  return (
    <div className="page">
      <Link to="/documenti" className="link-btn">
        ← Documenti
      </Link>
      <article className="card prose selectable" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
