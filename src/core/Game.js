import { Chess } from "../vendor/chess.mjs";

// Wraps chess.js with small conveniences
export class Game {
  constructor() {
    this.ch = new Chess();
    this.redo = [];
  }
  reset() {
    this.ch.reset();
    this.redo.length = 0;
  }
  load(fen) {
    const ok = this.ch.load(fen);
    if (ok) this.redo.length = 0;
    return ok;
  }
  loadPgn(pgn) {
    const ok = this.ch.loadPgn(pgn);
    if (ok) this.redo.length = 0;
    return ok;
  }
  fen() {
    return this.ch.fen();
  }
  pgn() {
    return this.ch.pgn();
  }
  turn() {
    return this.ch.turn();
  }
  inCheck() {
    return this.ch.isCheck();
  }
  inCheckmate() {
    return this.ch.isCheckmate();
  }
  inDraw() {
    return this.ch.isDraw();
  }
  history() {
    return this.ch.history();
  }
  historyVerbose() {
    return this.ch.history({ verbose: true });
  }

  get(square) {
    return this.ch.get(square) || null;
  }

  legalMovesFrom(square, color = null) {
    try {
      if (!color || color === this.ch.turn()) {
        return this.ch.moves({ square, verbose: true }).map((m) => m.to);
      }
      const parts = this.ch.fen().split(" ");
      parts[1] = color;
      const temp = new Chess(parts.join(" "));
      return temp.moves({ square, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }

  premoveLegalMovesFrom(square, color) {
    const piece = this.get(square);
    if (!piece || (color && piece.color !== color)) return [];
    if (!color || color === this.ch.turn()) {
      return this.legalMovesFrom(square, color);
    }
    const baseFenParts = this.ch.fen().split(" ");
    baseFenParts[1] = color;
    const baseFen = baseFenParts.join(" ");
    const kingSq = this.ch
      .board()
      .flat()
      .find((p) => p && p.type === "k" && p.color === color)?.square;
    const base = new Chess(baseFen);
    if (kingSq) base.remove(kingSq);
    const moves = new Set(
      base.moves({ square, verbose: true, legal: false }).map((m) => m.to),
    );
    for (const row of this.ch.board()) {
      for (const p of row) {
        if (p && p.color === color && p.square !== square) {
          const temp = new Chess(baseFen);
          if (kingSq) temp.remove(kingSq);
          temp.remove(p.square);
          const mvs = temp
            .moves({ square, verbose: true, legal: false })
            .map((m) => m.to);
          if (mvs.includes(p.square)) moves.add(p.square);
        }
      }
    }
    return Array.from(moves);
  }

  move(obj) {
    const m = this.ch.move(obj);
    if (m) this.redo.length = 0;
    return m;
  }
  moveUci(uci) {
    const m = uci.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (!m) return null;
    return this.move({ from: m[1], to: m[2], promotion: m[3] || undefined });
  }
  moveSan(san) {
    const m = this.ch.move(san);
    if (m) this.redo.length = 0;
    return m;
  }
  undo() {
    const u = this.ch.undo();
    if (u) this.redo.push(u);
    return u;
  }
  redoOne() {
    const u = this.redo.pop();
    if (!u) return null;
    this.ch.move(u);
    return u;
  }
}
