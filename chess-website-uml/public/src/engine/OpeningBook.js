// OpeningBook.js
// Expanded offline opening book for the first ~12 plies (6 moves each side).
// Keys are SAN sequences joined by spaces; values are arrays of [SAN, weight].

const BOOK = {
  "": [["e4",5],["d4",4],["c4",3],["Nf3",3],["g3",1],["b3",1]],

  // --- King's Pawn (1.e4) replies
  "e4": [["e5",5],["c5",5],["e6",3],["c6",3],["d6",2],["d5",1]],

  // --- Queen's Pawn / English / Reti first moves
  "d4": [["d5",5],["Nf6",5],["g6",2],["e6",3]],
  "c4": [["e5",3],["Nf6",4],["c5",3],["e6",3],["g6",2]],
  "Nf3": [["d5",3],["Nf6",4],["g6",2],["c5",1]],

  // === Open Games: Italian, Ruy, Scotch, Four Knights ===
  "e4 e5": [["Nf3",6],["Bc4",2],["Nc3",1]],
  "e4 e5 Nf3": [["Nc6",6],["Nf6",3],["d6",1]],

  // Ruy Lopez
  "e4 e5 Nf3 Nc6": [["Bb5",5],["Bc4",3],["d4",2]],
  "e4 e5 Nf3 Nc6 Bb5": [["a6",6],["Nf6",3],["Bc5",1]],
  "e4 e5 Nf3 Nc6 Bb5 a6": [["Ba4",5],["Bxc6",3]],
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4": [["Nf6",6],["d6",2]],
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6": [["O-O",6],["d3",2],[ "Nc3",1]],
  "e4 e5 Nf3 Nc6 Bb5 Nf6": [["O-O",5],["d3",2],["Nc3",1]],

  // Italian / Giuoco Piano
  "e4 e5 Nf3 Nc6 Bc4": [["Bc5",6],["Nf6",3]],
  "e4 e5 Nf3 Nc6 Bc4 Bc5": [["c3",4],["d3",3],["O-O",2],["b4",1]],
  "e4 e5 Nf3 Nc6 Bc4 Nf6": [["d3",3],["Ng5",3],["Nc3",2],["O-O",2]],

  // Scotch
  "e4 e5 Nf3 Nc6": [["d4",3],["Bb5",5],["Bc4",2]],
  "e4 e5 Nf3 Nc6 d4 exd4": [["Nxd4",6]],
  "e4 e5 Nf3 Nc6 d4": [["exd4",6],["Nf6",2]],

  // Four Knights
  "e4 e5 Nf3 Nc6 Nc3": [["Nf6",6],["Bc5",2]],
  "e4 e5 Nf3 Nc6 Nc3 Nf6": [["Bb5",3],["d4",3],["Bc4",2]],

  // Petrov / Philidor
  "e4 e5 Nf3 Nf6": [["Nxe5",5],["d4",3]],
  "e4 e5 Nf3 d6": [["d4",5],["Bc4",3]],

  // Scandinavian
  "e4 d5": [["exd5",6],["e5",1]],
  "e4 d5 exd5": [["Qxd5",6],[ "Nf6",1 ]],
  "e4 d5 exd5 Qxd5": [["Nc3",6],["Nf3",2]],

  // --- Sicilian Defence ---
  "e4 c5": [["Nf3",6],["Nc3",3],[ "c3",2 ]],
  "e4 c5 Nf3": [["d6",4],["Nc6",4],["e6",3],[ "g6",2 ]],
  "e4 c5 Nc3": [["Nc6",4],[ "d6",3 ],["e6",2]],

  // Najdorf setup
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3": [["a6",6],[ "e6",2 ]],
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6": [["Nc3",6],[ "Bd3",1 ]],
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6": [["Be2",3],["Be3",3],[ "Bg5",3 ],["f3",2]],

  // Classical/Dragon shells
  "e4 c5 Nf3 Nc6": [["d4",5],["Bb5",3]],
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4": [["g6",3],["e5",2],["Nf6",3]],
  "e4 c5 Nf3 d6": [["d4",6],[ "Bb5+",2 ]],
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4": [["Nf6",6],[ "a6",2 ],["g6",2]],

  // --- French Defence ---
  "e4 e6": [["d4",6],[ "Nc3",2 ]],
  "e4 e6 d4 d5": [["Nc3",4],["Nd2",3],["exd5",2],["e5",2]],
  "e4 e6 d4 d5 Nc3": [["Nf6",4],["Bb4",4],[ "dxe4",2 ]],
  "e4 e6 d4 d5 Nd2": [["c5",3],["Nf6",3],[ "dxe4",2 ]],

  // --- Caro–Kann ---
  "e4 c6": [["d4",5],[ "Nc3",2 ],["Nf3",2]],
  "e4 c6 d4 d5": [["Nc3",3],["Nd2",3],["exd5",3],[ "e5",2 ]],
  "e4 c6 d4 d5 Nc3": [["dxe4",5],[ "Nf6",2 ]],
  "e4 c6 d4 d5 dxe4": [["Qxd8+",3],["Nc3",3],[ "Bd3",2 ]],

  // --- Pirc / Modern ---
  "e4 d6": [["d4",5],[ "Nc3",3 ]],
  "e4 d6 d4 Nf6": [["Nc3",5],["Bd3",1]],
  "e4 g6": [["d4",5],[ "Nc3",3 ]],
  "e4 g6 d4 Bg7": [["Nc3",4],["Nf3",4],[ "c3",2 ]],

  // === Queen's Pawn Games: QG, Slav, Indian ===
  "d4 d5": [["c4",6],["Nf3",3],[ "e3",2 ]],
  "d4 d5 c4": [["e6",5],["c6",4],[ "dxc4",2 ]],
  "d4 d5 c4 e6": [["Nc3",4],["Nf3",4],[ "g3",2 ]],
  "d4 d5 c4 c6": [["Nf3",4],["Nc3",3],[ "e3",2 ]],

  // QGD lines
  "d4 d5 c4 e6 Nc3 Nf6": [["Nf3",4],["Bg5",3],[ "cxd5",1 ]],
  "d4 d5 c4 e6 Nf3 Nf6": [["Nc3",4],["Bg5",3],[ "g3",2 ]],
  "d4 d5 c4 e6 Nc3": [["Nf6",5],["Be7",2]],

  // Slav / Semi-Slav branches
  "d4 d5 c4 c6 Nf3": [["Nf6",5],[ "e6",3 ]],
  "d4 d5 c4 c6 Nc3": [["Nf6",5],[ "e6",3 ]],
  "d4 d5 c4 c6 Nf3 Nf6": [["Nc3",4],["e3",3],[ "Qc2",1 ]],

  // QGA
  "d4 d5 c4 dxc4": [["Nf3",4],["e3",3],[ "e4",2 ]],
  "d4 d5 c4 dxc4 Nf3": [["Nf6",4],[ "e6",3 ]],

  // Indian families
  "d4 Nf6": [["c4",6],["Nf3",4],[ "g3",2 ]],
  "d4 Nf6 c4": [["g6",4],["e6",4],[ "c5",2 ]],
  "d4 Nf6 c4 g6": [["Nc3",5],["Nf3",4]],
  "d4 Nf6 c4 g6 Nc3": [["Bg7",6],[ "d6",2 ]],
  "d4 Nf6 c4 g6 Nc3 Bg7": [["e4",4],["Nf3",4],[ "g3",2 ]],
  "d4 Nf6 c4 g6 Nc3 Bg7 e4": [["d6",5],[ "d5",2 ]],

  // Nimzo / QID shells
  "d4 Nf6 c4 e6": [["Nc3",5],["Nf3",4]],
  "d4 Nf6 c4 e6 Nc3": [["Bb4",5],[ "d5",2 ]],
  "d4 Nf6 c4 e6 Nf3": [["b6",4],["d5",4]],

  // Catalan
  "d4 Nf6 c4 e6 g3": [["d5",5],[ "Bb4+",2 ]],
  "d4 Nf6 c4 e6 g3 d5": [["Nf3",5],[ "Bg2",4 ]],

  // English / Reti follow-ups
  "c4 e5": [["Nc3",5],["g3",3],[ "Nf3",2 ]],
  "c4 Nf6": [["Nc3",5],["g3",3],[ "Nf3",2 ]],
  "c4 c5": [["Nf3",4],["Nc3",4]],
  "Nf3 d5": [["g3",3],["d4",3],[ "c4",2 ]],
  "Nf3 Nf6": [["g3",3],["c4",3],[ "d4",2 ]],

  // A few practical anti-lines
  "e4 e5 Bc4": [["Nf6",4],["Nc6",4]],
  "e4 c5 c3": [["d5",4],["Nf6",3]],
  "e4 c5 Nc3 Nc6": [["Nf3",3],["g3",2]],
  "e4 e5 d4": [["exd4",6],[ "Nf6",2 ]],
  "d4 Nf6 Nf3": [["g6",4],["d5",4]]
};

function pickWeighted(list){
  const total = list.reduce((a,[,w])=>a+w,0);
  let r = Math.random()*total;
  for(const [m,w] of list){ r -= w; if(r<=0) return m; }
  return list[0][0];
}

export function getBookMove({ sanHistory, ply, mode, enabled=true }) {
  if (!enabled || mode !== 'play') return null;
  if (typeof ply === 'number' && ply >= 12) return null; // limit to ~6 moves each side
  const key = String(sanHistory || '').trim();
  const entry = BOOK[key];
  return entry ? pickWeighted(entry) : null;
}
