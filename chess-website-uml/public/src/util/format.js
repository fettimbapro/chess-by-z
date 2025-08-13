export const formatTime = (ms) => {
  const s = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(s/60), r = s%60;
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
};

// Simple logistic to convert centipawns to [0..1] win-prob-like bar (rough)
export function scoreToPct(cp, sideToMove){
  const p = 1/(1+Math.exp(-cp/120));
  return (sideToMove === 'w') ? p : (1-p);
}

