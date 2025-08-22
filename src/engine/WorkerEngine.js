import { Engine } from "./Engine.js";
import { allocateMoveTime, estimateComplexity } from "./TimeManager.js";

// Uses a JS engine in a Module Worker. Variant can be "classic" or "strong".
export class WorkerEngine extends Engine {
  constructor({ variant = "classic" } = {}) {
    super();
    const script =
      variant === "strong"
        ? "../workers/strong-engine.js"
        : "../workers/mini-engine.js";
    this.worker = new Worker(new URL(script, import.meta.url), {
      type: "module",
    });
    this.req = 0;
    this.waiting = new Map();
    this.worker.onmessage = (e) => {
      const msg = e.data || {};
      const pend = this.waiting.get(msg.id);
      if (!pend) return;
      if (msg.type === "analysis") {
        if (msg.final) {
          pend.resolve(msg.lines);
          this.waiting.delete(msg.id);
        } else {
          pend.onProgress?.(msg.lines, msg.depth);
        }
      } else if (msg.type === "bestmove") {
        pend.resolve(msg.uci);
        this.waiting.delete(msg.id);
      } else {
        pend.reject(new Error("Unknown response"));
        this.waiting.delete(msg.id);
      }
    };
  }

  _postAwait(payload, { onProgress } = {}) {
    const id = ++this.req;
    payload.id = id;
    const p = new Promise((resolve, reject) =>
      this.waiting.set(id, { resolve, reject, onProgress }),
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
      onProgress,
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
    return this._postAwait(
      { type: "analyze", fen, depth, multipv, timeMs },
      { onProgress },
    );
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
