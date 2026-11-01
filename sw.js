/* QA ONLY: same-origin, fixed-asset cache. Never a production worker. */
'use strict';
const RELEASE="c", CACHE='pet-meal-pwa-qa-'+RELEASE;
const ROOT=new URL('./',self.location.href);
const ASSETS=["./", "./IMG_9853.jpeg", "./IMG_9860.jpeg", "./about/", "./analytics-consent.css", "./analytics-consent.js", "./assets/cat-es-v3.png", "./assets/cat-nl-v3.png", "./assets/dog-es-v3.png", "./assets/dog-nl-v3.png", "./cat-icon.jpeg%20.jpg", "./cat/", "./cat/manifest.webmanifest", "./check-sync.js", "./dog-icon.jpeg%20.jpg", "./en/cat/", "./en/cat/%E3%81%AD%E3%81%93%E3%82%A2%E3%83%95%E3%82%9A%E3%83%AA%E6%B5%B7%E5%A4%96%E7%89%88.JPG", "./en/cat/manifest.webmanifest", "./en/dog/", "./en/dog/%E3%81%84%E3%81%AC%E3%81%82%E3%81%B5%E3%82%9A%E3%82%8A%E6%B5%B7%E5%A4%96%E7%89%88.JPG", "./en/dog/manifest.webmanifest", "./en/privacy/", "./i18n-data.js", "./i18n-pages.js", "./i18n.css", "./i18n.js", "./manifest.webmanifest", "./privacy/", "./pwa.js", "./qa-config.js", "./qa-fixture", "./qa-measurement-fixture.js", "./qa-ui.css", "./qa-ui.js", "./rakuten-products.js", "./sharing-en.js"].map(p=>new URL(p,ROOT).href);
const ALLOWED=new Set(ASSETS);
const ALIASES=new Map([["./index.html", "./"], ["./cat/index.html", "./cat/"], ["./en/dog/index.html", "./en/dog/"], ["./en/cat/index.html", "./en/cat/"], ["./privacy/index.html", "./privacy/"], ["./en/privacy/index.html", "./en/privacy/"], ["./about/index.html", "./about/"], ["./qa-fixture.html", "./qa-fixture"]].map(([from,to])=>[new URL(from,ROOT).href,new URL(to,ROOT).href]));
self.addEventListener('install',event=>event.waitUntil((async()=>{
  if(ROOT.hostname==='8810h8810.github.io')throw Error('QA worker refuses production host');
  await (await caches.open(CACHE)).addAll(ASSETS.map(url=>new Request(url,{method:'GET',credentials:'omit',redirect:'error',cache:'reload'})));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('pet-meal-pwa-qa-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(['QA_ACTIVATE_UPDATE','ACTIVATE_UPDATE'].includes(event.data?.type))self.skipWaiting();
  if(event.data?.type==='QA_STATUS'&&event.ports?.[0])event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),keys=await cache.keys(),missing=[];
    for(const url of ASSETS)if(!await cache.match(url))missing.push(url.slice(ROOT.href.length));
    event.ports[0].postMessage({release:RELEASE,cache:CACHE,expected:ASSETS.length,cached:keys.length,complete:missing.length===0,missing});
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  const target=ALIASES.get(url.href)||url.href;
  // Covers every controlled request: unknown paths and external origins cannot
  // fall through to the network, even if later HTML accidentally adds one.
  if(request.method!=='GET'||url.origin!==ROOT.origin||!ALLOWED.has(target)){
    event.respondWith(Promise.resolve(new Response('QA: request blocked',{status:410,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}})));return;
  }
  event.respondWith((async()=>{
    const cached=await(await caches.open(CACHE)).match(target);
    if(cached)return cached;
    return fetch(new Request(target,{method:'GET',credentials:'omit',redirect:'error'}));
  })());
});
