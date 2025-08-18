// Simple wiring layer between DOM and Clock
export class ClockPanel {
  constructor({ clock, els }){
    this.clock = clock;
    this.els = els;

    // initial values
    this.applyInputs();

    // inputs
    els.timeMin.addEventListener('change', () => { this.applyInputs(); this.render(); });
    els.incSec.addEventListener('change', () => { this.applyInputs(); this.render(); });

    // clock callbacks
    this.clock.onTick = () => this.render();
  }

  applyInputs(){
    const minutes = parseInt(this.els.timeMin.value || '5', 10);
    const inc = parseInt(this.els.incSec.value || '0', 10);
    this.clock.set(minutes, inc);
    this.clock.setTurn(this.els.turnSupplier());
  }

  startIfNotRunning(){
    this.clock.setTurn(this.els.turnSupplier());
    this.clock.startIfNotRunning();
  }

  pause(){ this.clock.pause(); }

  render(){
    this.clock.renderTo(this.els.white, this.els.black);
  }
}

