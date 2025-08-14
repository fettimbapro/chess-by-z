import { formatTime } from '../util/format.js';

export class Clock {
  constructor(){
    this.base = 5*60*1000;
    this.inc = 3*1000;
    this.white = this.base;
    this.black = this.base;
    this.turn = 'w';
    this.timer = null;
    this.ticking = false;

    // callbacks
    this.onTick = null; // () => void
    this.onFlag = null; // (side: 'w'|'b') => void
  }

  set(baseMinutes, incSeconds){
    this.base = baseMinutes*60*1000;
    this.inc = incSeconds*1000;
    this.white = this.black = this.base;
    this.turn = 'w';
  }

  setTurn(side){ this.turn = (side === 'b') ? 'b' : 'w'; }

  start(){
    if (this.timer) clearInterval(this.timer);
    this.ticking = true;
    this.timer = setInterval(()=>this.tick(),100);
  }

  startIfNotRunning(){ if (!this.ticking) this.start(); }

  pause(){
    this.ticking = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  reset(){
    this.white = this.black = this.base;
    this.turn = 'w';
  }

  onMoveApplied(){
    if (this.turn==='w') this.white += this.inc; else this.black += this.inc;
    this.turn = (this.turn==='w')?'b':'w';
  }

  tick(){
    if (!this.ticking) return;
    if (this.turn==='w'){
      this.white -= 100;
      if (this.white <= 0){
        this.white = 0;
        this.ticking = false;
        this.pause(); // Clear interval to avoid background work
        this.onFlag && this.onFlag('w');
      }
    } else {
      this.black -= 100;
      if (this.black <= 0){
        this.black = 0;
        this.ticking = false;
        this.pause(); // Clear interval to avoid background work
        this.onFlag && this.onFlag('b');
      }
    }
    this.onTick && this.onTick();
  }

  renderTo(elWhite, elBlack){
    elWhite.textContent = `White ${formatTime(this.white)}`;
    elBlack.textContent = `Black ${formatTime(this.black)}`;
  }
}

