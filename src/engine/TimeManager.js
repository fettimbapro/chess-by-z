import { Chess } from "../vendor/chess.mjs";
import { logError } from "../util/ErrorHandler.js";

export function estimateComplexity(fen) {
  let moves = [];
  try {
    const ch = new Chess(fen);
    moves = ch.moves({ verbose: true });
  } catch (err) {
    logError(err, "TimeManager.estimateComplexity");
    return 0;
  }
  let complexity = moves.length;
  let tactical = 0;
  for (const mv of moves) {
    const flags = mv.flags || "";
    if (
      flags.includes("c") ||
      flags.includes("e") ||
      flags.includes("k") ||
      flags.includes("p") ||
      (mv.san && mv.san.includes("+"))
    ) {
      tactical++;
    }
  }
  return complexity + tactical;
}

export function allocateMoveTime({
  timeLeftMs,
  incrementMs = 0,
  movesToGo = 30,
  complexity = 20,
}) {
  const reserve = timeLeftMs * 0.05; // keep 5% buffer
  const remaining = Math.max(0, timeLeftMs - reserve);
  let base = remaining / Math.max(1, movesToGo);
  base += incrementMs * 0.8; // use most of increment

  let factor = 1;
  if (complexity >= 40) factor = 2;
  else if (complexity >= 30) factor = 1.5;
  else if (complexity >= 20) factor = 1.2;

  let alloc = base * factor;
  alloc = Math.min(alloc, remaining);
  if (timeLeftMs < 1000) alloc = Math.min(alloc, timeLeftMs * 0.5); // panic mode
  return Math.max(1, Math.round(alloc));
}
