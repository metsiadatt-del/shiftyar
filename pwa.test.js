import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const code=await readFile(new URL('sw.js',root),'utf8');
function worker(){const handlers={},stored=new Map();let assets=[],claimed=false,skipped=false;const cache={addAll:async list=>{assets=list;list.forEach(path=>stored.set(path,{path}));},match:async request=>{const key=typeof request==='string'?request:request.url;return stored.get(key)||stored.get('./'+key.replace('https://example.test/shiftyar/',''));}};const context={URL,self:{skipWaiting:async()=>{skipped=true;},location:{origin:'https://example.test'},registration:{scope:'https://example.test/shiftyar/'},clients:{claim:async()=>{claimed=true;}},addEventListener:(name,handler)=>handlers[name]=handler},caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},fetch:async()=>{throw new Error('offline');}};vm.runInNewContext(code,context);return {handlers,getAssets:()=>assets,getClaimed:()=>claimed,getSkipped:()=>skipped};}
test('Service worker precaches every local app dependency',async()=>{const w=worker();let promise;w.handlers.install({waitUntil:p=>promise=p});await promise;for(const asset of w.getAssets())await access(new URL(asset,root));for(const required of ['./app.js','./spreadsheet.js','./vendor/fflate.js','./assets/vazirmatn-arabic.woff2'])assert.ok(w.getAssets().includes(required));});
test('Offline navigation fallback works under GitHub Pages subdirectory',async()=>{const w=worker();let p;w.handlers.install({waitUntil:x=>p=x});await p;w.handlers.fetch({request:{url:'https://example.test/shiftyar/?offline=1',method:'GET',mode:'navigate'},respondWith:x=>p=x});assert.equal((await p).path,'./index.html');});
test('Service worker ignores external requests',()=>{const w=worker();let called=false;w.handlers.fetch({request:{url:'https://other.test/file',method:'GET',mode:'cors'},respondWith:()=>called=true});assert.equal(called,false);});
test('Install manifest uses relative scope and valid actual PNG icons',async()=>{const m=JSON.parse(await readFile(new URL('manifest.webmanifest',root)));assert.equal(m.scope,'./');assert.equal(m.start_url,'./');for(const icon of m.icons){const data=await readFile(new URL(icon.src,root));assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');const [width,height]=icon.sizes.split('x').map(Number);assert.equal(data.readUInt32BE(16),width);assert.equal(data.readUInt32BE(20),height);}});
test('Responsive styles include mobile safe areas, unified palette and print',async()=>{const css=await readFile(new URL('styles.css',root),'utf8');for(const rule of ['max-width:560px','max-width:850px','prefers-reduced-motion','safe-area-inset-bottom','--bg:#21232e','--accent:#f17300','--line:#105bff','@media print','[hidden]{display:none!important}'])assert.ok(css.includes(rule));});

test('New shell precaches versioned entry assets and activates without closing old tabs',async()=>{
 const w=worker();let p;w.handlers.install({waitUntil:x=>p=x});await p;
 assert.equal(w.getSkipped(),true);
 for(const path of ['./styles.css?v=18','./boot.js?v=18','./app.bundle.js?v=18','./assets/background-wave.svg?v=18'])assert.ok(w.getAssets().includes(path));
 w.handlers.activate({waitUntil:x=>p=x});await p;assert.equal(w.getClaimed(),true);
});
test('Document URLs bypass an old cache containing only unversioned files',async()=>{
 const html=await readFile(new URL('index.html',root),'utf8');
 for(const file of ['styles.css','boot.js','app.bundle.js'])assert.ok(html.includes(file+'?v=18'));
 const css=await readFile(new URL('styles.css',root),'utf8');assert.ok(css.includes('background-wave.svg?v=18'));
});

test('Versioned CSS, bundle and wave are available offline with query strings intact',async()=>{
 const w=worker();let p;w.handlers.install({waitUntil:x=>p=x});await p;
 for(const path of ['styles.css?v=18','app.bundle.js?v=18','assets/background-wave.svg?v=18']){
  w.handlers.fetch({request:{url:'https://example.test/shiftyar/'+path,method:'GET',mode:'cors'},respondWith:x=>p=x});
  assert.equal((await p).path,'./'+path);
 }
});
