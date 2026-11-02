import test from 'node:test';
import assert from 'node:assert/strict';

// DOM/canvas shim verifies module initialization and A/B/C state transitions.
// It is not a substitute for a screenshot/visual browser test.
test('browser interface loads and the clock buttons respond', async () => {
  const dom = new Map();
  function element(id = '') {
    return {
      id, innerHTML: '', textContent: '', value: '', files: [],
      classList: { toggle() {}, add() {}, remove() {} },
      listeners: {},
      addEventListener(event, fn) { this.listeners[event] = fn; },
      click() { this.listeners.click?.({ preventDefault() {} }); },
      replaceChildren(...children) { this.children = children; },
      getContext() { return { fillStyle: '', fillRect() {} }; }
    };
  }
  globalThis.document = {
    getElementById(id) {
      if (!dom.has(id)) dom.set(id, element(id));
      return dom.get(id);
    },
    createElement() { return element(); },
    addEventListener() {}
  };
  const saves = new Map();
  globalThis.localStorage = {
    getItem: key => saves.get(key) || null,
    setItem: (key, value) => saves.set(key, value)
  };
  globalThis.window = {};
  const oldInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    await import('../src/main.js?smoke=' + Date.now());
    assert.equal(dom.get('screen-label').textContent, 'Set the time');
    dom.get('c').click();
    assert.equal(dom.get('screen-label').textContent, 'Waiting for the egg');
    dom.get('b').click();
    assert.equal(dom.get('screen-label').textContent, 'Clock');
    dom.get('combo').click();
    assert.equal(dom.get('screen-label').textContent, 'Set the time');
    dom.get('c').click();
    assert.equal(dom.get('screen-label').textContent, 'Waiting for the egg');
    assert.ok(saves.get('classic-pocket-p1-state-v2'));
  } finally {
    globalThis.setInterval = oldInterval;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.window;
  }
});
