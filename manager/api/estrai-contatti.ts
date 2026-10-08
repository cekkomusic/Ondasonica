/**
 * Legge una pagina web (e, se serve, la pagina "Contatti" dello stesso sito) ed estrae
 * titolo, descrizione, email, telefoni e profili social. Nessun servizio esterno a pagamento.
 */
import { json } from "./_lib.js";

const MAX = 2 * 1024 * 1024;

const hostPrivato = (h: string) =>
  /^(localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|::1|fc|fd)/i.test(h) || h.endsWith(".internal");

async function scarica(url: URL): Promise<string | null> {
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "user-agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36",
        "accept-language": "it-IT,it;q=0.9",
      },
    });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("html")) return null;
    const buf = await r.arrayBuffer();
    return new TextDecoder("utf-8").decode(buf.slice(0, MAX));
  } catch {
    return null;
  }
}

const decodifica = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#64;|&#x40;/gi, "@")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const meta = (html: string, nome: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*content=["']([^"']+)`, "i"))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${nome}["']`, "i"))?.[1];

/** Email "offuscate" da Cloudflare (data-cfemail). */
const cfEmails = (html: string) =>
  [...html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)].map(([, hex]) => {
    const k = parseInt(hex.slice(0, 2), 16);
    let out = "";
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
    return out;
  });

export function estrai(htmlGrezzo: string, base: URL) {
  const html = decodifica(htmlGrezzo);
  const testo = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");

  const emails = new Set<string>();
  for (const m of [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => m[1])) emails.add(decodeURIComponent(m));
  for (const m of testo.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) emails.add(m);
  for (const m of cfEmails(htmlGrezzo)) emails.add(m);
  const emailOk = [...emails]
    .map((e) => e.trim().replace(/[.,;:]+$/, "").toLowerCase())
    .filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !/(sentry|example\.|wixpress|domain\.com|@2x|u00)/.test(e))
    .slice(0, 8);

  const tel = new Set<string>();
  for (const m of html.matchAll(/href=["']tel:([^"']+)/gi)) tel.add(decodeURIComponent(m[1]).trim());
  for (const m of testo.match(/(?:\+39[\s.]?)?(?:3\d{2}|0\d{1,3})[\s./-]?\d{3,4}[\s./-]?\d{3,4}\b/g) ?? []) {
    const cifre = m.replace(/\D/g, "").replace(/^39(?=\d{9,10}$)/, "");
    if (cifre.length >= 9 && cifre.length <= 11) tel.add(m.trim());
  }
  const telOk = [...tel].filter((t, i, a) => a.findIndex((x) => x.replace(/\D/g, "").slice(-9) === t.replace(/\D/g, "").slice(-9)) === i).slice(0, 6);

  const social = new Set<string>();
  for (const m of html.matchAll(/href=["'](https?:\/\/(?:www\.|m\.)?(?:facebook\.com|instagram\.com|tiktok\.com|youtube\.com)\/[^"'#?\s]+)/gi)) {
    const u = m[1].replace(/\/$/, "");
    if (!/(sharer|share\.php|dialog|plugins|intent|\/p\/|\/watch|\/embed|\/reel\/|policy|legal)/i.test(u)) social.add(u);
  }

  const titolo = meta(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "";
  const descrizione = meta(html, "og:description") ?? meta(html, "description") ?? "";
  const sito = meta(html, "og:site_name") ?? "";

  // Link alla pagina contatti dello stesso sito, se presente.
  let contatti: string | undefined;
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    if (/contatt|contact|dove-siamo|chi-siamo|info/i.test(m[1] + " " + m[2])) {
      try {
        const u = new URL(m[1], base);
        if (u.host === base.host && u.href !== base.href) {
          contatti = u.href;
          break;
        }
      } catch {
        /* link non valido */
      }
    }
  }

  return {
    titolo: titolo.trim().slice(0, 140),
    descrizione: descrizione.trim().slice(0, 400),
    sito: sito.trim(),
    emails: emailOk,
    telefoni: telOk,
    social: [...social].slice(0, 5),
    contatti,
  };
}

export async function POST(request: Request) {
  let raw = "";
  try {
    raw = String(((await request.json()) as { url?: string }).url ?? "").trim();
  } catch {
    /* corpo non valido */
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return json({ errore: "link non valido" }, 400);
  }
  if (process.env.VERCEL && hostPrivato(url.hostname)) return json({ errore: "indirizzo non permesso" }, 400);

  const html = await scarica(url);
  if (!html) {
    const fb = /facebook\.com|instagram\.com/i.test(url.hostname);
    return json(
      {
        errore: fb
          ? "Facebook e Instagram non permettono di leggere le pagine senza login: copia i contatti a mano dalla pagina."
          : "Non riesco a leggere questa pagina (sito non raggiungibile o protetto).",
        fonte: url.href,
      },
      422,
    );
  }
  const dati = estrai(html, url);

  // Se mancano email/telefoni, prova la pagina contatti dello stesso sito.
  if ((!dati.emails.length || !dati.telefoni.length) && dati.contatti) {
    const html2 = await scarica(new URL(dati.contatti));
    if (html2) {
      const d2 = estrai(html2, new URL(dati.contatti));
      dati.emails = [...new Set([...dati.emails, ...d2.emails])].slice(0, 8);
      dati.telefoni = [...new Set([...dati.telefoni, ...d2.telefoni])].slice(0, 6);
      dati.social = [...new Set([...dati.social, ...d2.social])].slice(0, 5);
    }
  }
  return json({ fonte: url.href, ...dati });
}
