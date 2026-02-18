import assert from 'node:assert/strict';
import test from 'node:test';
import app from './app';

test('GET /health returns ok', async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    assert(address && typeof address === 'object', 'server should expose a bound port');

    const res = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
