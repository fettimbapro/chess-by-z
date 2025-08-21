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
    const moveUci = await side.play(game.fen());
    if (!moveUci) {
      log.push(
        `ply ${ply}: ${side === strong ? "strong" : "weak"} had no legal move`,
      );
      break;
    }
    game.move({
      from: moveUci.slice(0, 2),
      to: moveUci.slice(2, 4),
      promotion: moveUci[4],
    });
    log.push(
      `ply ${ply}: ${side === strong ? "strong" : "weak"} -> ${moveUci}`,
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

  return { id, result, pgn: game.pgn(), log };
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
    console.log(`PGN: ${match.pgn}`);
    console.groupEnd();
  }

  return results;
}

if (typeof window !== "undefined") {
  window.runMatches = runMatches;
}
