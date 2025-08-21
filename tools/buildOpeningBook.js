import fs from "fs";
import path from "path";
import readline from "readline";

const SRC_DIR = "lib/lichess_opening_db";
const OUT_FILE = "src/engine/openingBookData.js";
const MAX_PLIES = 12; // ~6 moves per side
const MAX_GAMES = Number(process.env.MAX_GAMES || Infinity);
let gameCount = 0;

/**
 * Record an occurrence of `move` after the given `sequence`.
 */
function record(map, sequence, move) {
  const key = sequence.trim();
  let next = map.get(key);
  if (!next) {
    next = new Map();
    map.set(key, next);
  }
  next.set(move, (next.get(move) || 0) + 1);
}

/**
 * Parse SAN move tokens from a game's movetext.
 */
function parseMoves(text) {
  // strip comments and variations
  text = text.replace(/\{[^}]*\}|\([^)]*\)/g, " ");
  const tokens = text.split(/\s+/);
  const moves = [];
  for (const tok of tokens) {
    if (!tok) continue;
    if (/^\d+\./.test(tok)) continue; // move number
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) break;
    const clean = tok.replace(/[!?+#]+/g, "");
    moves.push(clean);
  }
  return moves;
}

/**
 * Process a single PGN game's movetext into the counts map.
 */
function processGame(text, counts) {
  const moves = parseMoves(text);
  for (let i = 0; i < moves.length && i < MAX_PLIES; i++) {
    const seq = moves.slice(0, i).join(" ");
    record(counts, seq, moves[i]);
  }
}

/**
 * Stream-parse a PGN file into the counts map.
 */
async function parseFile(file, counts) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  let movetext = "";
  let inMoves = false;
  for await (const line of rl) {
    if (line.startsWith("[")) continue; // tag pair
    if (!line.trim()) {
      if (inMoves) {
        processGame(movetext, counts);
        movetext = "";
        inMoves = false;
        gameCount++;
        if (gameCount >= MAX_GAMES) {
          rl.close();
          break;
        }
      }
      continue;
    }
    inMoves = true;
    movetext += " " + line.trim();
  }
  if (movetext && gameCount < MAX_GAMES) {
    processGame(movetext, counts);
    gameCount++;
  }
}

async function main() {
  const counts = new Map();
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.startsWith("lichess_split_") && f.endsWith(".pgn"))
    .sort();
  for (const f of files) {
    await parseFile(path.join(SRC_DIR, f), counts);
    if (gameCount >= MAX_GAMES) break;
  }
  const obj = {};
  for (const [seq, map] of counts.entries()) {
    obj[seq] = [...map.entries()].sort((a, b) => b[1] - a[1]);
  }
  const out = `export default ${JSON.stringify(obj, null, 2)};\n`;
  fs.writeFileSync(OUT_FILE, out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
