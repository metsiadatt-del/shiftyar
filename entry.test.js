import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { webcrypto } from 'node:crypto';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const boot = await readFile(new URL('../boot.js', import.meta.url), 'utf8');
const bundle = await readFile(new URL('../app.bundle.js', import.meta.url), 'utf8');
function setup(protocol = 'file:') {
  const { window, document } = parseHTML(html);
  const storage = new Map();
  let registrations = 0;
  const context = vm.createContext({ window, document, console, Intl, Date, URL, Blob,
    location: { hash: '', protocol, reload() {} }, crypto: webcrypto, structuredClone,
    matchMedia: () => ({ matches: false }), setTimeout, clearTimeout,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    navigator: { serviceWorker: { register: async () => { registrations++; } } }
  });
  window.scrollTo = () => {};
  return { window, document, context, registrations: () => registrations };
}
test('HTML loads ordered classic scripts, not file-blocked modules', () => {
  const { document } = parseHTML(html);
  const scripts = [...document.querySelectorAll('script[src]')];
  assert.deepEqual(scripts.map(s => s.getAttribute('src')), ['boot.js', 'app.bundle.js']);
  assert.ok(scripts.every(s => s.hasAttribute('defer') && s.type !== 'module'));
  assert.ok(document.querySelector('#startup').textContent.trim());
});
test('Delivered bundle renders all main tabs in a file-protocol DOM without module fetching', () => {
  const env = setup();
  vm.runInContext(boot, env.context);
  vm.runInContext(bundle, env.context);
  assert.equal(env.document.querySelector('#startup'), null);
  assert.ok(env.document.querySelector('.calendar'));
  for (const page of ['shift', 'directory', 'reports', 'planning', 'profile', 'calendar']) {
    env.document.querySelector(`[data-action="navigate"][data-page="${page}"]`).dispatchEvent(new env.window.Event('click', { bubbles: true }));
    assert.ok(env.document.querySelector('#main h1').textContent);
  }
  assert.equal(env.registrations(), 0);
});
test('HTTPS launch still registers offline support', () => {
  const env = setup('https:');
  vm.runInContext(bundle, env.context);
  assert.equal(env.registrations(), 1);
});
test('A missing or failing bundle leaves an actionable message instead of a blank page', () => {
  const env = setup();
  vm.runInContext(boot, env.context);
  env.window.dispatchEvent(new env.window.Event('error'));
  assert.equal(env.document.querySelector('#startup').getAttribute('role'), 'alert');
  assert.match(env.document.querySelector('#startup-message').textContent, /کامل نشد/);
  assert.match(env.document.querySelector('#startup-help').textContent, /app.bundle.js/);
  assert.match(env.document.querySelector('#startup-help').textContent, /پاک نکنید/);
});
