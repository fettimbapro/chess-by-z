import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const base = "http://127.0.0.1:8080";

async function withServer(fn) {
  const proc = spawn("python", ["serve.py"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  try {
    await fn();
  } finally {
    proc.kill();
  }
}

test("fetches puzzle by rating filter and respects exclude", async () => {
  await withServer(async () => {
    const url = `${base}/api/puzzle?ratingMin=399&ratingMax=399`;
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const p1 = await res.json();
    assert.equal(p1.rating, 399);

    const res2 = await fetch(`${url}&exclude=${encodeURIComponent(p1.id)}`);
    assert.equal(res2.status, 200);
    const p2 = await res2.json();
    assert.equal(p2.rating, 399);
    assert.notEqual(p1.id, p2.id);
  });
});
