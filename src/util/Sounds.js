export class Sounds {
  constructor() {
    this.ctx = null;
  }

  play(name) {
    try {
      const ctx =
        this.ctx ||
        (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const now = ctx.currentTime;

      // slight variation each play
      const detune = 1 + (Math.random() - 0.5) * 0.1; // ±5%

      const profiles = {
        move: { filter: 1500, osc: 200, dur: 0.2 },
        capture: { filter: 1000, osc: 160, dur: 0.2 },
        check: { filter: 1700, osc: 400, dur: 0.25 },
        checkmate: { filter: 1800, osc: 600, dur: 0.3 },
        airhorn: {
          filter: 1200,
          osc: 300,
          dur: 0.8,
          gain: 0.12,
          type: "triangle",
        },
        fart: {
          filter: 200,
          osc: 80,
          dur: 0.5,
          gain: 0.2,
          type: "sawtooth",
        },
      };
      const p =
        (window?.secretMode ? profiles.fart : profiles[name]) || profiles.move;

      const gain = ctx.createGain();
      const maxGain = p.gain ?? 0.09;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(maxGain, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);

      // soft noise burst to mimic cushioned piece drop
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = p.filter * detune;
      filter.Q.value = 0.5;
      noise.connect(filter);
      filter.connect(gain);

      // subtle tone or horn
      const osc = ctx.createOscillator();
      osc.type = p.type || "sine";
      osc.frequency.value = p.osc * detune;
      osc.connect(gain);

      noise.start(now);
      osc.start(now);
      noise.stop(now + p.dur);
      osc.stop(now + p.dur);

      gain.connect(ctx.destination);
    } catch {
      // ignore playback errors
    }
  }
}
