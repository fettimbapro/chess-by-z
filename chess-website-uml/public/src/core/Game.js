import { Chess } from '../vendor/chess.mjs';

// Wraps chess.js with small conveniences
export class Game {
  constructor(){
    this.ch = new Chess();
    this.redo = [];
  }
  reset(){ this.ch.reset(); this.redo.length = 0; }
  load(fen){ const ok = this.ch.load(fen); if (ok) this.redo.length = 0; return ok; }
  fen(){ return this.ch.fen(); }
  pgn(){ return this.ch.pgn(); }
  turn(){ return this.ch.turn(); }
  inCheck(){ return this.ch.isCheck(); }
  inCheckmate(){ return this.ch.isCheckmate(); }
  inDraw(){ return this.ch.isDraw(); }
  history(){ return this.ch.history(); }
  historyVerbose(){ return this.ch.history({ verbose:true }); }

  get(square){ return this.ch.get(square) || null; }

  legalMovesFrom(square){
    try{
      return this.ch.moves({ square, verbose:true }).map(m => m.to);
    }catch{ return []; }
  }

  move(obj){ const m = this.ch.move(obj); if (m) this.redo.length = 0; return m; }
  moveUci(uci){
    const m = uci.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/); if (!m) return null;
    return this.move({ from:m[1], to:m[2], promotion:m[3]||undefined });
  }
  moveSan(san){ const m = this.ch.move(san); if (m) this.redo.length = 0; return m; }
  undo(){ const u = this.ch.undo(); if (u) this.redo.push(u); return u; }
  redoOne(){ const u = this.redo.pop(); if (!u) return null; this.ch.move(u); return u; }
}

