// Offline opening detector using ECO codes.
// Entries in `openingsECO.json` contain `{ eco, name, san, fen }`.
// Matches the longest SAN or FEN prefix.

let OPENINGS = [];
try {
  const res = await fetch(new URL("./openingsECO.json", import.meta.url));
  OPENINGS = await res.json();
} catch {
  try {
    const fs = await import("fs/promises");
    const text = await fs.readFile(
      new URL("./openingsECO.json", import.meta.url),
    );
    OPENINGS = JSON.parse(text);
  } catch {
    OPENINGS = [];
  }
}

export function detectOpening(arg = {}) {
  let san;
  let fen;

  if (typeof arg === "object" && !Array.isArray(arg)) {
    san = arg.san;
    fen = arg.fen;
  } else {
    san = arg;
  }

  const list = Array.isArray(san)
    ? san.slice()
    : String(san || "")
        .trim()
        .split(/\s+/);
  const hist = list.join(" ").trim();
  const fenStr = String(fen || "").trim();

  let best = null;
  let bestLen = -1;

  for (const entry of OPENINGS) {
    if (entry.san) {
      if (hist === entry.san || hist.startsWith(entry.san + " ")) {
        const len = entry.san.length;
        if (len > bestLen) {
          best = entry;
          bestLen = len;
        }
      }
    }
    if (entry.fen) {
      if (fenStr && (fenStr === entry.fen || fenStr.startsWith(entry.fen))) {
        const len = entry.fen.length;
        if (len > bestLen) {
          best = entry;
          bestLen = len;
        }
      }
    }
  }

  return best ? { eco: best.eco, name: best.name } : null;
}
