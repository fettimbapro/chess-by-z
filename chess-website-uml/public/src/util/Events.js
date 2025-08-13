export class EventBus {
  constructor(){ this.map = new Map(); }
  on(type, fn){ const a = this.map.get(type)||[]; a.push(fn); this.map.set(type,a); return () => this.off(type, fn); }
  off(type, fn){ const a = this.map.get(type)||[]; const i=a.indexOf(fn); if (i>=0){ a.splice(i,1); this.map.set(type,a); } }
  emit(type, payload){ const a = this.map.get(type)||[]; for (const fn of a) fn(payload); }
}

