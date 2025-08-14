import { Engine } from "./Engine.js";
import { allocateMoveTime, estimateComplexity } from "./TimeManager.js";

// Uses our JS mini-engine in a Module Worker
export class WorkerEngine extends Engine {
  constructor() {
    super();
    this.worker = new Worker(
      new URL("../workers/mini-engine.js", import.meta.url),
      { type: "module" }, // IMPORTANT: module worker
    );
    this.req = 0;
    this.waiting = new Map();
    this.worker.onmessage = (e) => {
      const msg = e.data || {};
      const pend = this.waiting.get(msg.id);
      if (!pend) return;
      if (msg.type === "analysis") pend.resolve(msg.lines);
      else if (msg.type === "bestmove") pend.resolve(msg.uci);
      else pend.reject(new Error("Unknown response"));
      this.waiting.delete(msg.id);
    };
  }

  _postAwait(payload) {
    const id = ++this.req;
    payload.id = id;
    const p = new Promise((resolve, reject) =>
      this.waiting.set(id, { resolve, reject }),
    );
    this.worker.postMessage(payload);
    return p;
  }

  analyze(
    fen,
    {
      depth = 6,
      multipv = 2,
      timeMs = 300,
      timeLeftMs,
      incrementMs = 0,
      movesToGo = 30,
    } = {},
  ) {
    if (typeof timeLeftMs === "number") {
      const comp = estimateComplexity(fen);
      timeMs = allocateMoveTime({
        timeLeftMs,
        incrementMs,
        movesToGo,
        complexity: comp,
      });
    }
    return this._postAwait({ type: "analyze", fen, depth, multipv, timeMs });
  }
  play(
    fen,
    {
      elo = 1600,
      depthCap = 6,
      timeMs = 300,
      timeLeftMs,
      incrementMs = 0,
      movesToGo = 30,
    } = {},
  ) {
    if (typeof timeLeftMs === "number") {
      const comp = estimateComplexity(fen);
      timeMs = allocateMoveTime({
        timeLeftMs,
        incrementMs,
        movesToGo,
        complexity: comp,
      });
    }
    return this._postAwait({ type: "play", fen, elo, depthCap, timeMs });
  }
  stop() {
    this.worker.postMessage({ type: "stop" });
  }
}
