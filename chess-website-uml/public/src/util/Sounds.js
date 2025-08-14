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
      gain.gain.linearRampToValueAtTime(0.09, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      // soft noise burst to mimic cushioned piece drop
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = name === 'capture' ? 1000 : 1500;
      filter.Q.value = 0.5;
      noise.connect(filter);
      filter.connect(gain);

      // subtle low thump
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = name === 'capture' ? 160 : 200;
      osc.connect(gain);

      noise.start(now);
      osc.start(now);
      noise.stop(now + 0.2);
      osc.stop(now + 0.2);

      gain.connect(ctx.destination);
    } catch {
      // ignore playback errors
    }
  }
}
