
// public/src/ui/SysArrowPolicy.js
// Prevent engine/system arrows from appearing during play mode.
// Assumes there is a <select id="modeSel"> or element with data-mode reflecting 'play' | 'analysis' | 'puzzle'.
// If absent, defaults to 'play' to be conservative.

(function(){
  function currentMode(){
    const sel = document.getElementById('modeSel') || document.querySelector('[data-mode]');
    if (!sel) return 'play';
    if (sel.value) return sel.value;
    const v = sel.getAttribute('data-mode') || sel.dataset?.mode;
    return v || 'play';
  }
  const proto = window.BoardUI && window.BoardUI.prototype;
  if (!proto || typeof proto.drawArrowUci !== 'function') return;

  const orig = proto.drawArrowUci;
  proto.drawArrowUci = function(uci, primary){
    // Clear old sys arrows each time
    try { this.clearArrow && this.clearArrow(); } catch {}
    // Only draw in analysis mode
    if (currentMode() !== 'analysis') return;
    return orig.call(this, uci, primary);
  };
})();
