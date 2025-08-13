// Minimal service with tolerant mapping for Lichess endpoints and local packs.
const LS_KEY = 'chesslab:puzzlePack';

export class PuzzleService {
  constructor(){
    this.pack = [];
    try { this.pack = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch {}
  }

  size(){ return this.pack.length|0; }
  save(){ try { localStorage.setItem(LS_KEY, JSON.stringify(this.pack)); } catch {} }

  importCsvText(text, limit=3000){
    // Expected headers from Lichess DB export: PuzzleId,FEN,Moves,Rating,...,Themes,GameUrl
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return 0;
    const head = lines[0].split(',');
    const idx = (k)=> head.indexOf(k);
    const iId=idx('PuzzleId'), iFen=idx('FEN'), iMoves=idx('Moves'), iRating=idx('Rating'), iThemes=idx('Themes'), iGame=idx('GameUrl');
    const out=[];
    for (let i=1; i<lines.length && out.length<limit; i++){
      const cols = safeCsvSplit(lines[i], head.length);
      if (!cols.length) continue;
      out.push({
        id: get(cols,iId), fen: get(cols,iFen),
        moves: get(cols,iMoves),
        rating: +(get(cols,iRating)||0),
        themes: get(cols,iThemes)||'',
        gameUrl: get(cols,iGame)||''
      });
    }
    this.pack = out;
    this.save();
    return out.length;
  }

  async downloadPackJson(url){
    const r = await fetch(url, { headers:{ 'accept':'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const arr = await r.json();
    if (!Array.isArray(arr)) throw new Error('JSON must be an array');
    this.pack = arr;
    this.save();
    return this.pack.length;
  }

  sample500(){
    if (!this.pack.length) return 0;
    const arr = [];
    const N = Math.min(500, this.pack.length);
    for (let i=0; i<N; i++) arr.push(this.pack[(Math.random()*this.pack.length)|0]);
    this.pack = arr;
    this.save();
    return this.pack.length;
  }

  randomFromPack({ theme='', min=0, max=4000 } = {}){
    const t = (theme||'').toLowerCase();
    const filtered = this.pack.filter(p => {
      const okR = (+(p.rating||0) >= min) && (+(p.rating||0) <= max);
      const okT = !t || String(p.themes||'').toLowerCase().includes(t);
      return okR && okT;
    });
    if (!filtered.length) return null;
    return filtered[(Math.random()*filtered.length)|0];
  }

  async fetchDaily(){
    // No auth needed; returns JSON. We leave shaping to the adapter.
    // Accept header matters per docs.
    const r = await fetch('https://lichess.org/api/puzzle/daily', { headers: { 'accept':'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  async fetchById(id){
    const r = await fetch(`https://lichess.org/api/puzzle/${encodeURIComponent(id)}`, { headers: { 'accept':'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }
}

// --- helpers ---
function get(a,i){ return (i>=0 && i<a.length) ? a[i] : ''; }
function safeCsvSplit(line, expect){
  // naive CSV splitter covering quotes; adequate for Lichess dumps
  const out=[]; let cur='', q=false;
  for (let i=0;i<line.length;i++){
    const ch=line[i];
    if (ch==='\"'){ if (q && line[i+1]==='\"'){ cur+='\"'; i++; } else q=!q; continue; }
    if (!q && ch===','){ out.push(cur); cur=''; continue; }
    cur+=ch;
  }
  out.push(cur);
  while(out.length<expect) out.push('');
  return out;
}

