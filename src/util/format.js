export const formatTime = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60),
    r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

// Simple logistic to convert centipawns to [0..1] win-prob-like bar (rough)
export function scoreToPct(cp, sideToMove) {
  const p = 1 / (1 + Math.exp(-cp / 120));
  return sideToMove === "w" ? p : 1 - p;
}

export const MATE_SCORE = 1e7;
export const INF_SCORE = 1e9;

export function formatScore(cp) {
  if (!Number.isFinite(cp)) return "?";
  if (Math.abs(cp) >= INF_SCORE) return "∞";
  if (Math.abs(cp) > MATE_SCORE - 1000) {
    const ply = MATE_SCORE - Math.abs(cp);
    const moves = Math.ceil(ply / 2);
    return `${cp > 0 ? "#" : "#-"}${moves}`;
  }
  return (cp / 100).toFixed(2);
}
