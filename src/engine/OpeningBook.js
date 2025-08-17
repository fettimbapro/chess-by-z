// OpeningBook.js
// Compact offline opening book containing only named openings.
// Keys are SAN sequences joined by spaces; values are arrays of [SAN, weight].

import BOOK from './openingBookData.js';

function pickWeighted(list){
  const total = list.reduce((a,[,w])=>a+w,0);
  let r = Math.random()*total;
  for(const [m,w] of list){
    r -= w;
    if(r<=0) return m;
  }
  return list[0][0];
}

export function getBookMove({ sanHistory, ply, mode, enabled=true }) {
  if (!enabled || mode !== 'play') return null;
  if (typeof ply === 'number' && ply >= 12) return null; // limit to ~6 moves each side
  const key = String(sanHistory || '').trim();
  const entry = BOOK[key];
  return entry ? pickWeighted(entry) : null;
}
