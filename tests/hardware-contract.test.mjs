import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('hardware page contains controls, safe local picker and hardware view', () => {
  const html = readFileSync(new URL('../hardware.html', import.meta.url), 'utf8');
  for (const id of ['hw-lcd','hw-a','hw-b','hw-c','hw-icon-0','hw-icon-7',
    'hw-rom','hw-export','hw-import','hw-status','hw-catchup'])
    assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /\.\/emu\/hardware-ui\.js/);
  assert.doesNotMatch(html, /<script[^>]+(https?:)?\/\//i);
});

test('worker rejects invalid firmware before attempting a WASM module import', async () => {
  const original = globalThis.self;
  const messages = [];
  globalThis.self = { postMessage(msg) { messages.push(msg); } };
  try {
    await import('../emu/worker.js?isolated=' + Date.now());
    await globalThis.self.onmessage({ data: { type: 'boot', rom: new ArrayBuffer(200) } });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'error');
    assert.match(messages[0].message, /16,384/);
  } finally {
    if (original === undefined) delete globalThis.self;
    else globalThis.self = original;
  }
});

test('WebAssembly pipeline never bundles a firmware image', () => {
  const script = readFileSync(new URL('../scripts/build-wasm.sh', import.meta.url), 'utf8');
  assert.match(script, /ce304d55f9a73c60232ce3f552e7983db3fa399c/);
  assert.match(script, /-sEXPORTED_RUNTIME_METHODS=HEAPU8/);
  assert.doesNotMatch(script, /(?:curl|wget)[^\n]+(?:\.rom|\.bin|tama\.b)/);
  const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(deploy, /scripts\/build-wasm\.sh/);
  assert.match(deploy, /hardware\.html/);
  assert.match(deploy, /firmware found|Firmware found/i);
});
