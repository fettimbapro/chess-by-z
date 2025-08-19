// Adapter.js
// Normalizes calls to whatever engine wrapper you already have.
// Pass in your existing engine instance (e.g., window.app.engine or window.engine).

import { logError } from "../util/ErrorHandler.js";

export class EngineAdapter {
  constructor(engineLike) {
    // Try a few common places
    this.eng = engineLike || window.app?.engine || window.engine || null;
  }

  hasEngine() {
    return !!this.eng;
  }

  setOption(name, value) {
    try {
      if (this.eng?.setOption) return this.eng.setOption(name, value);
      if (this.eng?.send)
        return this.eng.send(`setoption name ${name} value ${value}`);
    } catch (err) {
      logError(err, "EngineAdapter.setOption");
    }
  }

  setDepth(n) {
    try {
      return this.eng?.setDepth
        ? this.eng.setDepth(n)
        : this.eng?.send?.(`depth ${n}`);
    } catch (err) {
      logError(err, "EngineAdapter.setDepth");
    }
  }

  setMoveTime(ms) {
    try {
      return this.eng?.setMoveTime
        ? this.eng.setMoveTime(ms)
        : this.eng?.send?.(`movetime ${ms}`);
    } catch (err) {
      logError(err, "EngineAdapter.setMoveTime");
    }
  }

  setMultiPV(n) {
    try {
      if (this.eng?.setMultiPV) return this.eng.setMultiPV(n);
      this.setOption("MultiPV", n);
    } catch (err) {
      logError(err, "EngineAdapter.setMultiPV");
    }
  }

  setPlayPrefs(opts) {
    try {
      return this.eng?.setPlayPrefs?.(opts);
    } catch (err) {
      logError(err, "EngineAdapter.setPlayPrefs");
    }
  }

  warmup() {
    try {
      return this.eng?.warmup?.();
    } catch (err) {
      logError(err, "EngineAdapter.warmup");
    }
  }

  send(cmd) {
    try {
      return this.eng?.send?.(cmd);
    } catch (err) {
      logError(err, "EngineAdapter.send");
    }
  }
}
