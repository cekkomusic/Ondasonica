/** Esportazione della scheda tecnica in PDF / JPG e condivisione del file. */

export type Formato = "pdf" | "jpg";

/** URL per caricare un'immagine esterna passando dal nostro server (evita i blocchi CORS). */
export const proxyImmagine = (url: string) => `/api/immagine?url=${encodeURIComponent(url.trim())}`;

/** Scarica l'immagine dello stage plot come blob locale; null se non disponibile. */
export async function caricaImmagine(url: string): Promise<{ src: string; errore?: undefined } | { src?: undefined; errore: string }> {
  if (!/^https?:\/\//i.test(url.trim())) return { errore: "link non valido" };
  try {
    const r = await fetch(proxyImmagine(url));
    if (!r.ok) return { errore: (await r.text()) || `errore ${r.status}` };
    return { src: URL.createObjectURL(await r.blob()) };
  } catch {
    return { errore: "immagine non raggiungibile" };
  }
}

const attendiImmagini = (el: HTMLElement) =>
  Promise.all(
    Array.from(el.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((ok) => ((img.onload = () => ok()), (img.onerror = () => ok()))),
    ),
  );

/** Genera il file a partire dall'elemento del foglio (larghezza fissa 794px = A4 a 96 dpi). */
export async function generaFile(el: HTMLElement, formato: Formato, nome: string): Promise<File> {
  await document.fonts?.ready;
  await attendiImmagini(el);
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });

  if (formato === "jpg") {
    const blob = await new Promise<Blob>((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("immagine non generata"))), "image/jpeg", 0.9));
    return new File([blob], `${nome}.jpg`, { type: "image/jpeg" });
  }

  // PDF A4: il foglio viene diviso in pagine tagliando SOLO tra una riga e l'altra
  // (mai a metà di una scritta), con un margine bianco in alto e in basso su ogni pagina.
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const pxPerPt = canvas.width / pw;
  const margine = 28; // pt
  const utilePx = Math.floor((ph - 2 * margine) * pxPerPt);

  // Punti di taglio sicuri: fine di ogni riga di testo, riga di tabella, immagine e sezione.
  // Il fondo di un titolo di sezione non è un punto di taglio (il titolo resta col suo contenuto).
  const rect = el.getBoundingClientRect();
  const scala = canvas.width / rect.width;
  const tagli = [...new Set(
    Array.from(el.querySelectorAll<HTMLElement>("[data-blocco], [data-riga]")).map((b) => Math.round((b.getBoundingClientRect().bottom - rect.top) * scala)),
  )].sort((a, b) => a - b);

  let y = 0;
  let pagina = 0;
  while (y < canvas.height - 2) {
    // la prima pagina parte dall'intestazione (che ha già il suo margine), le altre con margine in alto
    const alto = pagina === 0 ? 0 : margine;
    const spazio = pagina === 0 ? Math.floor((ph - margine) * pxPerPt) : utilePx;
    let fine = Math.min(y + spazio, canvas.height);
    if (fine < canvas.height) {
      const buono = tagli.filter((t) => t > y + spazio * 0.3 && t <= fine).pop();
      if (buono) fine = buono;
    }
    const pezzo = document.createElement("canvas");
    pezzo.width = canvas.width;
    pezzo.height = fine - y;
    const ctx = pezzo.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, pezzo.width, pezzo.height);
    ctx.drawImage(canvas, 0, y, canvas.width, fine - y, 0, 0, canvas.width, fine - y);
    if (pagina > 0) pdf.addPage();
    pdf.addImage(pezzo.toDataURL("image/jpeg", 0.92), "JPEG", 0, alto, pw, (fine - y) / pxPerPt);
    pagina++;
    y = fine;
  }
  return new File([pdf.output("blob")], `${nome}.pdf`, { type: "application/pdf" });
}

export const puoCondividereFile = (f: File) => {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
};

export function scaricaFile(f: File) {
  const url = URL.createObjectURL(f);
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
