/**
 * Simple publish/subscribe event bus.
 * Allows components to communicate without tight coupling.
 */
export class EventBus {
  constructor(){ this.map = new Map(); }
  /**
   * Register an event listener.
   * @param {string} type event type
   * @param {(payload:any)=>void} fn handler function
   * @returns {() => void} function to remove the listener
   */
  on(type, fn){ const a = this.map.get(type)||[]; a.push(fn); this.map.set(type,a); return () => this.off(type, fn); }
  /**
   * Remove a previously registered listener.
   * @param {string} type event type
   * @param {(payload:any)=>void} fn handler to remove
   */
  off(type, fn){
    const a = this.map.get(type) || [];
    const i = a.indexOf(fn);
    if (i >= 0) {
      a.splice(i, 1);
      // Clean up empty arrays to avoid leaking keys
      if (a.length > 0) this.map.set(type, a); else this.map.delete(type);
    }
  }

  /**
   * Emit an event to all listeners.
   * @param {string} type event type
   * @param {any} payload data passed to listeners
   */
  emit(type, payload){
    const a = this.map.get(type) || [];
    // Iterate over a snapshot so listeners can safely remove themselves
    for (const fn of [...a]) fn(payload);
  }
}
