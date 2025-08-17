// Abstract interface for chess engines
export class Engine {
  async analyze(_fen, _opts){ throw new Error('Not implemented'); }
  async play(_fen, _opts){ throw new Error('Not implemented'); }
  stop(){ /* optional */ }
}

