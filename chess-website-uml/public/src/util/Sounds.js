export class Sounds {
  constructor() {
    this.ctx = null;
  }

  play(name) {
    try {
      const ctx = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.1;
      osc.type = 'sine';
      if (name === 'move') {
        osc.frequency.value = 600;
      } else if (name === 'capture') {
        osc.frequency.value = 420;
      } else {
        return;
      }
      osc.connect(gain).connect(ctx.destination);
      const dur = name === 'capture' ? 0.4 : 0.25;
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // ignore playback errors
    }
  }
}
