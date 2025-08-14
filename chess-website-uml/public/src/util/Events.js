export class EventBus {
  constructor(){ this.map = new Map(); }
  on(type, fn){ const a = this.map.get(type)||[]; a.push(fn); this.map.set(type,a); return () => this.off(type, fn); }
  off(type, fn){
    const a = this.map.get(type) || [];
    const i = a.indexOf(fn);
    if (i >= 0) {
      a.splice(i, 1);
      // Clean up empty arrays to avoid leaking keys
      if (a.length > 0) this.map.set(type, a); else this.map.delete(type);
    }
  }

  emit(type, payload){
    const a = this.map.get(type) || [];
    // Iterate over a snapshot so listeners can safely remove themselves
    for (const fn of [...a]) fn(payload);
  }
}

