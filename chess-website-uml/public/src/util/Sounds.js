export class Sounds {
  constructor() {
    this.ctx = null;
  }

  play(name) {
    try {
      const ctx = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + 0.6);

      const freqs =
        name === 'move'
          ? [261.63, 329.63, 392.0] // C major
          : name === 'capture'
            ? [220.0, 261.63, 311.13] // A minor
            : null;
      if (!freqs) return;

      freqs.forEach((f) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.6);
      });

      gain.connect(ctx.destination);
    } catch {
      // ignore playback errors
    }
  }
}
