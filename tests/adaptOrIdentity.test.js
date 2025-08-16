import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptOrIdentity } from '../chess-website-uml/public/src/puzzles/PuzzleUI.js';
import { Chess } from '../chess-website-uml/public/src/vendor/chess.mjs';

const SAMPLE = {
  puzzle: {
    id: 'p123',
    fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    rating: 1500,
    themes: ['fork'],
    solution: ['d7d5', 'e4d5', 'd8d5', 'b1c3']
  },
  game: { id: 'ABCDEFG' }
};

const EXPECTED_SAN = ['d5', 'exd5', 'Qxd5', 'Nc3'];

test('adaptOrIdentity adapts Lichess daily puzzle', async () => {
  const res = await adaptOrIdentity(SAMPLE);
  assert.equal(res.fen, SAMPLE.puzzle.fen);
  assert.deepEqual(res.solutionSan, EXPECTED_SAN);
});

const SAMPLE_STR = {
  puzzle: {
    id: 'p124',
    fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    rating: 1500,
    themes: ['fork'],
    solution: 'd7d5 e4d5 d8d5 b1c3'
  }
};

test('adaptOrIdentity handles solution strings', async () => {
  const res = await adaptOrIdentity(SAMPLE_STR);
  assert.equal(res.fen, SAMPLE_STR.puzzle.fen);
  assert.deepEqual(res.solutionSan, EXPECTED_SAN);
});

const SAMPLE_GAME_FEN = {
  puzzle: {
    id: 'p125',
    rating: 1500,
    themes: ['fork'],
    solution: ['d7d5', 'e4d5']
  },
  game: {
    id: 'HIJKLMN',
    fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
  }
};

test('adaptOrIdentity uses game FEN when puzzle FEN missing', async () => {
  const res = await adaptOrIdentity(SAMPLE_GAME_FEN);
  assert.equal(res.fen, SAMPLE_GAME_FEN.game.fen);
  assert.deepEqual(res.solutionSan, ['d5', 'exd5']);
});

const SAMPLE_PGN_FEN = {
  game: {
    id: '06iacbDF',
    pgn: 'e4 d5 exd5 Qxd5 Nc3 Qd8 d4 e5 Nf3 exd4 Nxd4 c5 Nb3 Qxd1+ Nxd1 c4 Bxc4 Bg4 O-O Bb4 Ne3 Be6 c3 Bc5 Re1 Bb6 Bxe6 fxe6 Nf5 Kf7 Nd6+ Kg6 Nxb7 Ne7 Rxe6+ Kf7 Re4 Rd8 Bg5 Rd7 N7c5 Bxc5 Nxc5 Rc7 b4 Nbc6 b5 Nd8 Rae1 Ng6 Na4 h6 Bf4 Nxf4 Rxf4+ Kg6 c4 Nb7 Re5 Rd8 h4 Na5 c5 a6 Re6+ Kh5 Rxa6 g5 Rff6 Nc4 Rxh6+ Kg4 hxg5 Re7 g6 Re1+ Kh2 Rdd1 f3+ Kg5 Rh3 Ne3 g7',
  },
  puzzle: {
    id: 'Q9cVx',
    rating: 1820,
    solution: ['e1h1', 'h2g3', 'e3f5', 'g3f2', 'd1d2'],
    themes: ['endgame', 'long', 'mateIn3'],
    initialPly: 82,
  },
};

test('adaptOrIdentity derives FEN from PGN and initial ply', async () => {
  const res = await adaptOrIdentity(SAMPLE_PGN_FEN);

  // Expected FEN by replaying the PGN up to the initial ply
  const exp = new Chess();
  const tokens = SAMPLE_PGN_FEN.game.pgn.trim().split(/\s+/);
  const target = SAMPLE_PGN_FEN.puzzle.initialPly + 1;
  let count = 0;
  for (const mv of tokens) {
    if (exp.move(mv)) {
      count++;
      if (count >= target) break;
    }
  }
  const expectedFen = exp.fen();
  assert.equal(res.fen, expectedFen);

  // Expected SAN from the solution UCI moves
  const tmp = new Chess(expectedFen);
  const expectedSan = [];
  for (const uci of SAMPLE_PGN_FEN.puzzle.solution) {
    const m = uci.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (!m) break;
    const step = tmp.move({ from: m[1], to: m[2], promotion: m[3] || undefined });
    if (!step) break;
    expectedSan.push(step.san);
  }
  assert.deepEqual(res.solutionSan, expectedSan);
});
