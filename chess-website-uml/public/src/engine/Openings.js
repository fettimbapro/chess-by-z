// Offline opening name detector (lightweight).
// Keys are SAN sequences from the start position; values are opening names.
// We match the LONGEST prefix present in this table.

const OPENINGS = {
  // Starting shells
  "e4": "King's Pawn Game",
  "d4": "Queen's Pawn Game",
  "c4": "English Opening",
  "Nf3": "Réti Opening",
  "g3": "King's Fianchetto Opening",
  "b3": "Larsen's Opening",

  // Open Games
  "e4 e5": "Open Game",
  "e4 e5 Nf3": "King's Knight Opening",
  "e4 e5 Nf3 Nc6": "Open Game (Four Knights/Italian/Ruy shells)",

  // Ruy Lopez
  "e4 e5 Nf3 Nc6 Bb5": "Ruy Lopez",
  "e4 e5 Nf3 Nc6 Bb5 a6": "Ruy Lopez, Morphy Defense",
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4": "Ruy Lopez, Morphy Defense",
  "e4 e5 Nf3 Nc6 Bb5 Nf6": "Ruy Lopez, Berlin Defense",

  // Italian / Giuoco Piano / Two Knights
  "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
  "e4 e5 Nf3 Nc6 Bc4 Bc5": "Giuoco Piano",
  "e4 e5 Nf3 Nc6 Bc4 Nf6": "Two Knights Defense",

  // Scotch
  "e4 e5 Nf3 Nc6 d4": "Scotch Game",
  "e4 e5 Nf3 Nc6 d4 exd4": "Scotch Game",

  // Four Knights
  "e4 e5 Nf3 Nc6 Nc3": "Four Knights Game",

  // Petrov / Philidor
  "e4 e5 Nf3 Nf6": "Petrov Defense",
  "e4 e5 Nf3 d6": "Philidor Defense",

  // Scandinavian
  "e4 d5": "Scandinavian Defense",
  "e4 d5 exd5 Qxd5": "Scandinavian Defense",

  // Sicilian
  "e4 c5": "Sicilian Defense",
  "e4 c5 Nf3": "Sicilian Defense",
  "e4 c5 Nc3": "Sicilian Defense, Closed",
  "e4 c5 Nf3 d6": "Sicilian Defense, Najdorf/Dragon shells",
  "e4 c5 Nf3 Nc6": "Sicilian Defense, Classical/Accelerated Dragon shells",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4": "Sicilian Defense, Open",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6": "Sicilian Defense, Najdorf",

  // French
  "e4 e6": "French Defense",
  "e4 e6 d4 d5": "French Defense",
  "e4 e6 d4 d5 Nc3": "French Defense, Classical",
  "e4 e6 d4 d5 Nd2": "French Defense, Tarrasch",
  "e4 e6 d4 d5 e5": "French Defense, Advance",

  // Caro–Kann
  "e4 c6": "Caro–Kann Defense",
  "e4 c6 d4 d5": "Caro–Kann Defense",
  "e4 c6 d4 d5 Nc3": "Caro–Kann Defense, Two Knights",
  "e4 c6 d4 d5 dxe4": "Caro–Kann Defense, Exchange",

  // Pirc / Modern
  "e4 d6": "Pirc Defense",
  "e4 g6": "Modern Defense",
  "e4 d6 d4 Nf6": "Pirc Defense",
  "e4 g6 d4 Bg7": "Modern Defense",

  // Queen's Pawn
  "d4 d5": "Queen's Gambit / QP Game",
  "d4 d5 c4": "Queen's Gambit",
  "d4 d5 c4 e6": "QGD: Queen's Gambit Declined",
  "d4 d5 c4 c6": "Slav Defense",
  "d4 d5 c4 dxc4": "QGA: Queen's Gambit Accepted",

  "d4 Nf6": "Indian Defense",
  "d4 Nf6 c4": "Indian Defense",
  "d4 Nf6 c4 g6": "King's Indian Defense / Grunfeld shells",
  "d4 Nf6 c4 g6 Nc3": "King's Indian Defense",
  "d4 Nf6 c4 g6 Nc3 Bg7": "King's Indian Defense",
  "d4 Nf6 c4 g6 Nc3 d5": "Grünfeld Defense",
  "d4 Nf6 c4 e6": "Nimzo/QID shells",
  "d4 Nf6 c4 e6 Nc3 Bb4": "Nimzo-Indian Defense",
  "d4 Nf6 c4 e6 Nf3 b6": "Queen's Indian Defense",
  "d4 Nf6 c4 e6 g3": "Catalan Opening",

  // English / Réti
  "c4 e5": "English Opening, Reversed Sicilian",
  "c4 c5": "English Opening, Symmetrical",
  "c4 Nf6": "English Opening",
  "Nf3 d5": "Réti Opening",
  "Nf3 Nf6": "Réti Opening",

  // A few extras
  "e4 e5 Bc4": "Bishop's Opening",
  "d4 Nf6 Nf3": "Indian Defense",
  "g3 d5": "King's Fianchetto Opening",
};

export function detectOpening(sanMoves) {
  const list = Array.isArray(sanMoves) ? sanMoves.slice() : String(sanMoves||'').trim().split(/\s+/);
  const hist = list.join(' ').trim();
  if (!hist) return '';

  // Try longest prefix match
  let best = '';
  let bestLen = -1;
  for (const key of Object.keys(OPENINGS)) {
    if (!key) continue;
    if (hist === key || hist.startsWith(key + ' ')) {
      if (key.length > bestLen) { best = OPENINGS[key]; bestLen = key.length; }
    }
  }
  return best || '';
}
