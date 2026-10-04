// Piccolo "tick" tattile. navigator.vibrate non esiste su iOS Safari:
// in quel caso (o se il browser lo blocca) non succede nulla.
export function tick(pattern: number | number[] = 12) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignorato */
  }
}
