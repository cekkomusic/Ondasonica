/**
 * Scarica un'immagine da un link (Google Drive, Dropbox o diretto) e la restituisce dallo stesso dominio
 * dell'app, così può essere inserita nel PDF/JPG della scheda tecnica e mostrata in anteprima.
 * Accetta solo immagini (max 10 MB).
 */
const MAX = 10 * 1024 * 1024;

/** Trasforma i link di condivisione più comuni nel link diretto al file. */
export function linkDiretto(raw: string): string {
  const u = new URL(raw);
  if (u.hostname.endsWith("drive.google.com") || u.hostname.endsWith("docs.google.com")) {
    const id = u.pathname.match(/\/d\/([\w-]{10,})/)?.[1] ?? u.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (u.hostname.endsWith("dropbox.com")) {
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return u.toString();
  }
  return u.toString();
}

const hostPrivato = (h: string) =>
  /^(localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|::1|fc|fd)/i.test(h) || h.endsWith(".internal");

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  let target: URL;
  try {
    target = new URL(linkDiretto(raw));
  } catch {
    return new Response("link non valido", { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) return new Response("link non valido", { status: 400 });
  if (process.env.VERCEL && hostPrivato(target.hostname)) return new Response("indirizzo non permesso", { status: 400 });

  let res: Response;
  try {
    res = await fetch(target, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "user-agent": "OndasonicaManager/1.0" } });
  } catch {
    return new Response("impossibile scaricare l'immagine", { status: 502 });
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/"))
    return new Response("il link non porta a un'immagine (su Drive il file deve essere condiviso con 'Chiunque abbia il link')", {
      status: 422,
    });
  if (Number(res.headers.get("content-length") ?? 0) > MAX) return new Response("immagine troppo grande", { status: 413 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX) return new Response("immagine troppo grande", { status: 413 });
  return new Response(buf, { headers: { "content-type": type, "cache-control": "public, max-age=3600" } });
}
