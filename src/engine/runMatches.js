import { WorkerEngine } from "./WorkerEngine.js";
import { Chess } from "../vendor/chess.mjs";

async function runMatch(id) {
  const strong = new WorkerEngine({ variant: "strong" });
  const weak = new WorkerEngine({ variant: "classic" });
  const game = new Chess();

  let side = strong;
  let ply = 1;
  const log = [];

  while (!game.isGameOver()) {
    const move = await side.play(game.fen());
    if (!move) {
      log.push(
        `ply ${ply}: ${side === strong ? "strong" : "weak"} had no legal move`,
      );
      break;
    }
    game.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4],
    });
    log.push(
      `ply ${ply}: ${side === strong ? "strong" : "weak"} -> ${move} | FEN: ${game.fen()}`,
    );
    side = side === strong ? weak : strong;
    ply++;
  }

  const result = game.isCheckmate()
    ? side === strong
      ? "weak wins"
      : "strong wins"
    : "draw";

  strong.worker.terminate();
  weak.worker.terminate();

  return { id, result, finalFen: game.fen(), log };
}

export async function runMatches(n = 10) {
  if (typeof Worker === "undefined") {
    const { Worker } = await import("node:worker_threads");
    globalThis.Worker = Worker;
  }

  const matches = Array.from({ length: n }, (_, i) => runMatch(i + 1));
  const results = await Promise.all(matches);

  for (const match of results) {
    console.group(`Match ${match.id}: ${match.result}`);
    match.log.forEach((line) => console.log(line));
    console.log(`Final FEN: ${match.finalFen}`);
    console.groupEnd();
  }

  return results;
}

if (typeof window !== "undefined") {
  window.runMatches = runMatches;
}
