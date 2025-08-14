// EngineTuner.js
// Elo → Depth/Think/MultiPV mapping, Threads/Hash/UCI options.
// Uses an EngineAdapter and RuntimeCaps; updates UI; emits app:tune events.

import { detectCaps, updateBadges } from './RuntimeCaps.js';

export class EngineTuner {
  constructor({ adapter, dom }) {
    this.adapter = adapter;         // EngineAdapter
    this.dom = dom || {};
    this.caps = detectCaps();
    this.lastMovetime = 300;
  }

  init() {
    // Badges
    updateBadges({
      threadsBadge: this.dom.threadsBadge,
      hashBadge: this.dom.hashBadge
    }, this.caps);

    // Wire events
    ['input','change'].forEach(ev=>{
      this.dom.mode?.addEventListener(ev, () => this.retune());
      this.dom.auto?.addEventListener(ev, () => this.retune());
      this.dom.elo?.addEventListener(ev, () => this.retune());
      this.dom.depth?.addEventListener(ev, () => this.pushManual());
      this.dom.multipv?.addEventListener(ev, () => this.pushManual());
    });

    // One-time warmup/options
    this._warmup();
    // Initial tune
    this.retune();
  }

  _warmup(){
    if (!this.adapter?.hasEngine()) return;
    // Core options
    this.adapter.setOption('Ponder', false);
    this.adapter.setOption('Threads', this.caps.threads);
    this.adapter.setOption('Hash', this.caps.hashMB);
    this.adapter.setOption('UCI_ShowWDL', true);
    // Modest move overhead for clock safety
    this.adapter.setOption('Move Overhead', 30);
    // Kick
    this.adapter.send?.('ucinewgame');
    this.adapter.warmup?.();
  }

  // Map Elo/Mode -> depth/think/multipv and strength controls
  mapElo(percent, mode='play'){
    const pct = Math.max(1, Math.min(100, +percent || 100));
    const E = 800 + (pct/100)*(3000-800);
    const skill = Math.round((E-800)/110); // 0..20 ~ 800..3000
    const baseDepth = Math.round(6 + (E-800)*(12/2200));  // 6..18
    const depth = Math.max(4, Math.min(22, mode==='analysis' ? baseDepth+2 : baseDepth));
    const movetime = Math.round(150 + (E-800)*(850/2200)) * (mode==='analysis' ? 1.6 : 1); // 150..~1000ms
    const multipv = (mode==='analysis' ? 3 : 1);
    const limitStrength = E < 3000;
    return { elo:Math.round(E), skill, depth, movetime: movetime|0, multipv, limitStrength };
  }

  _applyToSliders(p){
    if (!this.dom) return;
    if (this.dom.depth){ this.dom.depth.value = p.depth; this.dom.depthVal.textContent = String(p.depth); }
    if (this.dom.multipv){ this.dom.multipv.value = p.multipv; this.dom.multipvVal.textContent = String(p.multipv); }
  }

  _setKnobsEnabled(disabled){
    const row = document.getElementById('knobsRow');
    if (!row) return;
    if (disabled) row.classList.add('disabledish'); else row.classList.remove('disabledish');
    if (this.dom.depth)   this.dom.depth.disabled = disabled;
    if (this.dom.multipv) this.dom.multipv.disabled = disabled;
  }

  _applyToEngine(p){
    if (!this.adapter?.hasEngine()) return;
    // Strength controls
    this.adapter.setOption('UCI_LimitStrength', !!p.limitStrength);
    if (p.limitStrength) this.adapter.setOption('UCI_Elo', p.elo);
    else                 this.adapter.setOption('Skill Level', 20);

    // Analysis mode hint
    const analyse = (this.dom.mode?.value === 'analysis');
    this.adapter.setOption('UCI_AnalyseMode', !!analyse);

    // Search prefs
    this.adapter.setMultiPV(p.multipv);
    this.adapter.setDepth(p.depth);
    this.adapter.setMoveTime(p.movetime);
    this.adapter.setPlayPrefs?.({ depth:p.depth, movetime:p.movetime, multipv:p.multipv });
  }

  retune(){
    const mode = this.dom.mode?.value || 'play';
    const elo  = +this.dom.elo?.value || 100;
    if (this.dom.eloVal) this.dom.eloVal.textContent = `${elo}%`;

    const p = this.mapElo(elo, mode);

    const auto = !!this.dom.auto?.checked;
    if (auto){ this._applyToSliders(p); this._setKnobsEnabled(true); }
    else { this._setKnobsEnabled(false); }

    const multipv = auto ? p.multipv : (+this.dom.multipv?.value || p.multipv);
    const depth   = auto ? p.depth   : (+this.dom.depth?.value   || p.depth);
    const movetime = p.movetime;

    const effective = { ...p, multipv, depth, movetime };
    this.lastMovetime = movetime;
    this._applyToEngine(effective);

    window.dispatchEvent(new CustomEvent('app:tune', {
      detail: {
        mode, auto,
        elo: p.elo, threads: this.caps.threads, hashMB: this.caps.hashMB,
        depth: effective.depth, movetime: effective.movetime, multipv: effective.multipv
      }
    }));
  }

  pushManual(){
    if (this.dom.auto?.checked) return; // manual only when auto is off
    const depth = +this.dom.depth?.value || 8;
    const multipv = +this.dom.multipv?.value || 1;
    const movetime = this.lastMovetime || 300;

    if (this.dom.depthVal) this.dom.depthVal.textContent = String(depth);
    if (this.dom.multipvVal) this.dom.multipvVal.textContent = String(multipv);

    this._applyToEngine({ depth, movetime, multipv, limitStrength:false });
    window.dispatchEvent(new CustomEvent('app:tune', { detail:{ auto:false, depth, movetime, multipv }}));
  }
}
