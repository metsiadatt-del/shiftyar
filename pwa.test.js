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
test('Responsive styles include mobile safe areas, unified palette and print',async()=>{const css=await readFile(new URL('styles.css',root),'utf8');for(const rule of ['max-width:767px','max-width:1024px','prefers-reduced-motion','safe-area-inset-bottom','--background:#f6f8fa','--accent:#347c82','--border:#dce3ea','@media print','[hidden]{display:none!important}'])assert.ok(css.includes(rule));});

test('New shell precaches versioned entry assets and activates without closing old tabs',async()=>{
 const w=worker();let p;w.handlers.install({waitUntil:x=>p=x});await p;
 assert.equal(w.getSkipped(),true);
 for(const path of ['./styles.css?v=23','./boot.js?v=23','./app.bundle.js?v=23','./assets/shiftyar-maskable.png?v=23'])assert.ok(w.getAssets().includes(path));
 w.handlers.activate({waitUntil:x=>p=x});await p;assert.equal(w.getClaimed(),true);
});
test('Document URLs bypass an old cache containing only unversioned files',async()=>{
 const html=await readFile(new URL('index.html',root),'utf8');
 for(const file of ['styles.css','boot.js','app.bundle.js'])assert.ok(html.includes(file+'?v=23'));
 const css=await readFile(new URL('styles.css',root),'utf8');assert.ok(css.includes('vazirmatn-arabic.woff2'));
});

test('Updated install icons are versioned, precached and available as Windows ICO',async()=>{
 const html=await readFile(new URL('index.html',root),'utf8'),manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root)));
 assert.ok(html.includes('assets/shiftyar-192.png?v=23'));
 const w=worker();let p;w.handlers.install({waitUntil:x=>p=x});await p;
 for(const icon of manifest.icons){assert.ok(icon.src.endsWith('?v=23'));assert.ok(w.getAssets().includes('./'+icon.src));}
 assert.ok(html.includes('href="favicon.ico?v=23" type="image/x-icon"'));
 assert.ok(w.getAssets().includes('./favicon.ico?v=23'));
 for(const font of ['noto-arabic.woff2','noto-latin.woff2'])assert.ok(w.getAssets().includes('./assets/'+font));
 assert.equal(manifest.name,'ShiftYar');assert.equal(manifest.short_name,'ShiftYar');assert.equal(manifest.icons.filter(i=>i.purpose==='maskable').length,1);
 const apple=await readFile(new URL('assets/shiftyar-180.png',root));assert.equal(apple.readUInt32BE(16),180);assert.ok(html.includes('assets/shiftyar-180.png?v=23'));assert.ok(w.getAssets().includes('./assets/shiftyar-180.png?v=23'));
 const ico=await readFile(new URL('favicon.ico',root));assert.equal(ico.readUInt16LE(2),1);assert.ok(ico.readUInt16LE(4)>=4);
});

test('Versioned CSS, bundle and wave are available offline with query strings intact',async()=>{
 const w=worker();let p;w.handlers.install({waitUntil:x=>p=x});await p;
 for(const path of ['styles.css?v=23','app.bundle.js?v=23','assets/shiftyar-maskable.png?v=23']){
  w.handlers.fetch({request:{url:'https://example.test/shiftyar/'+path,method:'GET',mode:'cors'},respondWith:x=>p=x});
  assert.equal((await p).path,'./'+path);
 }
});
