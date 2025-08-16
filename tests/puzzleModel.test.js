import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptLichessPuzzle } from '../chess-website-uml/public/src/puzzles/PuzzleModel.js';

// Sample puzzle shaped like Lichess API response
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

test('adaptLichessPuzzle keeps initial FEN and full solution', () => {
  const res = adaptLichessPuzzle(SAMPLE);
  assert.equal(res.fen, SAMPLE.puzzle.fen);
  assert.deepEqual(res.solutionSan, EXPECTED_SAN);
});
