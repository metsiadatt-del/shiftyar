import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { webcrypto } from 'node:crypto';
import { nowParts, dateNumeric, duration } from '../core.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const boot = await readFile(new URL('../boot.js', import.meta.url), 'utf8');
const bundle = await readFile(new URL('../app.bundle.js', import.meta.url), 'utf8');
function setup(protocol = 'file:', theme, dark = false) {
  const { window, document } = parseHTML(html);
  const storage = new Map(theme ? [['shiftyar-theme', theme]] : []);
  let registrations = 0;
  const context = vm.createContext({ window, document, console, Intl, Date, URL, Blob,
    location: { hash: '', protocol, reload() {} }, crypto: webcrypto, structuredClone,
    matchMedia: () => ({ matches: dark }), setTimeout, clearTimeout,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    navigator: { onLine:true, serviceWorker: { ready:Promise.resolve({}), register: async () => { registrations++; } } }
  });
  window.scrollTo = () => {};
  for(const d of document.querySelectorAll('dialog')){d.showModal=()=>d.setAttribute('open','');d.close=()=>d.removeAttribute('open');}
  return { window, document, context, registrations: () => registrations };
}
test('HTML loads ordered classic scripts, not file-blocked modules', () => {
  const { document } = parseHTML(html);
  const scripts = [...document.querySelectorAll('script[src]')];
  assert.deepEqual(scripts.map(s => s.getAttribute('src')), ['boot.js?v=23', 'app.bundle.js?v=23']);
  assert.ok(scripts.every(s => s.hasAttribute('defer') && s.type !== 'module'));
  assert.ok(document.querySelector('#startup').textContent.trim());
});
test('Delivered bundle renders all main tabs in a file-protocol DOM without module fetching', () => {
  const env = setup();
  vm.runInContext(boot, env.context);
  vm.runInContext(bundle, env.context);
  assert.equal(env.document.querySelector('#startup'), null);
  assert.ok(env.document.querySelector('.calendar'));
  for (const page of ['directory', 'reports', 'planning', 'profile', 'calendar']) {
    env.document.querySelector(`[data-action="navigate"][data-page="${page}"]`).dispatchEvent(new env.window.Event('click', { bubbles: true }));
    assert.ok(env.document.querySelector('#main h1').textContent);
  }
  assert.equal(env.registrations(), 0);
});
test('New shift and template default to 20:00–00:00 with today in Tehran', () => {
  const env = setup();
  vm.runInContext(bundle, env.context);
  const click = selector => env.document.querySelector(selector).dispatchEvent(new env.window.Event('click', { bubbles: true }));
  click('[data-action="new-shift"]');
  assert.equal(env.document.querySelector('[name="date"]').value, dateNumeric(nowParts().date));
  assert.equal(env.document.querySelector('[name="start"]').value, '20:00');
  assert.equal(env.document.querySelector('[name="end"]').value, '00:00');
  assert.equal(duration('20:00', '00:00'), 4);
  click('[data-action="navigate"][data-page="planning"]');
  click('[data-action="plan-tab"][data-value="templates"]');
  assert.equal(env.document.querySelector('[name="start"]').value, '20:00');
  assert.equal(env.document.querySelector('[name="end"]').value, '00:00');
});
test('Bundle respects saved themes and falls back to system appearance',()=>{
 for(const [saved,dark,expected] of [[undefined,true,'dark'],[undefined,false,'light'],['light',true,'light'],['dark',false,'dark'],['system',true,'dark']]){
  const env=setup('file:',saved,dark);vm.runInContext(bundle,env.context);
  assert.equal(env.document.documentElement.dataset.theme,expected);
  assert.equal(env.document.querySelector('meta[name="theme-color"]').getAttribute('content'),expected==='dark'?'#111820':'#f6f8fa');
 }
});

test('Early theme initialization runs before styles without waiting for the bundle',()=>{
 const {document}=parseHTML(html),script=document.querySelector('script:not([src])').textContent;
 assert.ok(html.indexOf(script)<html.indexOf('rel="stylesheet"'));
 for(const [theme,dark,expected] of [['dark',false,'dark'],['light',true,'light'],[undefined,true,'dark']]){const env=setup('file:',theme,dark);vm.runInContext(script,env.context);assert.equal(env.document.documentElement.dataset.theme,expected);}
});
test('HTTPS launch still registers offline support', () => {
  const env = setup('https:');
  vm.runInContext(bundle, env.context);
  assert.equal(env.registrations(), 1);
});
test('Offline status waits for cache readiness and responds to connectivity without rerendering',async()=>{
 const env=setup('https:');let ready;env.context.navigator.serviceWorker.ready=new Promise(resolve=>{ready=resolve;});vm.runInContext(bundle,env.context);const main=env.document.querySelector('#main');assert.match(env.document.querySelector('[data-offline-status]').textContent,/آماده‌سازی/);ready({});await new Promise(resolve=>setTimeout(resolve,0));assert.match(env.document.querySelector('[data-offline-status]').textContent,/آمادهٔ استفاده آفلاین/);env.context.navigator.onLine=false;env.window.dispatchEvent(new env.window.Event('offline'));assert.match(env.document.querySelector('[data-offline-status]').textContent,/اطلاعات روی دستگاه/);assert.equal(env.document.querySelector('#main'),main);
});
test('Brand and approved icon are present in the actual delivered bundle',()=>{
 const env=setup();vm.runInContext(bundle,env.context);assert.match(env.document.title,/ShiftYar/);assert.equal(env.document.querySelector('.brand strong').textContent,'ShiftYar');assert.equal(env.document.querySelector('.app-icon').getAttribute('src'),'assets/shiftyar-192.png?v=23');assert.equal(env.document.querySelector('.topbar-center').textContent,'MET');
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
