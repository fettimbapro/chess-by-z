import fs from "fs";
import path from "path";
import readline from "readline";
import { Chess } from "../src/vendor/chess.mjs";

const SRC_DIR = "lib/lichess_opening_db";
const OUT_FILE = "src/engine/openingsECO.json";
const MAX_OPENINGS = 100;
const MAX_PLIES = 16; // up to 8 moves each side

function parseMoves(text) {
  text = text.replace(/\{[^}]*\}|\([^)]*\)/g, " ");
  const tokens = text.split(/\s+/);
  const moves = [];
  for (const tok of tokens) {
    if (!tok) continue;
    if (/^\d+\./.test(tok)) continue;
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) break;
    const clean = tok.replace(/[!?+#]+/g, "");
    moves.push(clean);
    if (moves.length >= MAX_PLIES) break;
  }
  return moves;
}

async function parseFile(file, map) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  let tags = {};
  let movetext = "";
  let inMoves = false;
  for await (const line of rl) {
    if (line.startsWith("[")) {
      const m = line.match(/^\[(\w+)\s+"([^"]+)"\]/);
      if (m) tags[m[1]] = m[2];
      continue;
    }
    if (!line.trim()) {
      if (inMoves) {
        processGame(tags, movetext, map);
        tags = {};
        movetext = "";
        inMoves = false;
      }
      continue;
    }
    inMoves = true;
    movetext += " " + line.trim();
  }
  if (inMoves) processGame(tags, movetext, map);
}

function processGame(tags, movetext, map) {
  const eco = tags.ECO;
  const name = tags.Opening;
  if (!eco || !name) return;
  const moves = parseMoves(movetext);
  if (moves.length === 0) return;
  const sanStr = moves.join(" ");
  const key = `${eco}|${name}`;
  let entry = map.get(key);
  if (!entry) {
    entry = { eco, name, count: 0, seqCounts: new Map() };
    map.set(key, entry);
  }
  entry.count++;
  entry.seqCounts.set(sanStr, (entry.seqCounts.get(sanStr) || 0) + 1);
}

async function main() {
  const map = new Map();
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.startsWith("lichess_split_") && f.endsWith(".pgn"))
    .sort();
  for (const f of files) {
    await parseFile(path.join(SRC_DIR, f), map);
  }
  const top = [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_OPENINGS)
    .map((entry) => {
      let bestSan = "";
      let bestCount = -1;
      for (const [san, c] of entry.seqCounts.entries()) {
        if (c > bestCount) {
          bestSan = san;
          bestCount = c;
        }
      }
      const chess = new Chess();
      for (const move of bestSan.split(" ")) {
        if (move) chess.move(move, { sloppy: true });
      }
      return {
        eco: entry.eco,
        name: entry.name,
        san: bestSan,
        fen: chess.fen(),
      };
    });
  fs.writeFileSync(OUT_FILE, JSON.stringify(top, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
