const CACHE = 'shiftyar-shell-v7';
const ASSETS = ['./','./index.html','./styles.css','./boot.js','./app.bundle.js','./app.js','./core.js','./spreadsheet.js','./vendor/fflate.js','./vendor/jalaali.js','./vendor/holidays.js','./assets/noto-arabic.woff2','./assets/noto-latin.woff2','./assets/estedad-arabic.woff2','./assets/estedad-latin.woff2','./assets/regular.woff2','./assets/bold.woff2','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/met-corner.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('shiftyar-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const stored=await cache.match(event.request);
    if(stored)return stored;
    try{return await fetch(event.request);}catch(error){
      if(event.request.mode==='navigate')return cache.match('./index.html');
      throw error;
    }
  }));
});
