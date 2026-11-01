'use strict';
// Service-worker lifecycle with local asset bytes and mock caches only.
// Does not register a worker, start a browser, or send any network request.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const base = 'https://8810h8810.github.io/pet-meal-check/';
const version = 'pet-meal-pwa-v15-consent-v2';
const oldVersion = 'pet-meal-pwa-v14-internal-exclusion';
let passed = 0;

function worker(options = {}) {
  const handlers = {}, deleted = [], requests = [], batches = [];
  const maps = new Map([[oldVersion,new Map([[base,{body:'OLD HTML'}],[base+'analytics-consent.js',{body:'OLD JS'}]])],['unrelated-user-cache',new Map([[base,{body:'UNRELATED'}]])]]);
  let skipped = 0, claimed = 0;
  function asset(url) {
    const u = new URL(url);assert.equal(u.origin,'https://8810h8810.github.io');assert.ok(u.pathname.startsWith('/pet-meal-check/'));assert.equal(u.search,'');assert.equal(u.hash,'');
    const relative = decodeURIComponent(u.pathname.slice('/pet-meal-check/'.length));
    const file = path.join(root,relative || 'index.html');
    const resolved = fs.statSync(file).isDirectory() ? path.join(file,'index.html') : file;
    return {url,body:fs.readFileSync(resolved)};
  }
  const caches = {
    async open(name) {
      if(!maps.has(name))maps.set(name,new Map());const map=maps.get(name);
      return {
        async addAll(urls) {
          batches.push(Array.from(urls));
          if(options.failInstall)throw Error('mock precache failure');
          const staged=Array.from(urls,url=>[url,asset(url)]);
          for(const [url,response] of staged)map.set(url,response);
        },
        async match(request) { return map.get(typeof request==='string'?request:request.url); }
      };
    },
    async keys(){return [...maps.keys()];},
    async delete(name){deleted.push(name);return maps.delete(name);}
  };
  const self = {location:{href:base+'sw.js'},addEventListener:(name,fn)=>handlers[name]=fn,
    skipWaiting:()=>skipped++,clients:{claim:async()=>claimed++}};
  vm.runInNewContext(source,{self,caches,URL,fetch:async request=>{requests.push(request.url);return {body:'MOCK FALLBACK'};}},{filename:'sw.js'});
  async function lifecycle(type) {let promise;handlers[type]({waitUntil:p=>promise=p});assert.ok(promise);await promise;}
  async function request(url,method='GET') {let promise;handlers.fetch({request:{url,method},respondWith:p=>promise=p});return promise?{handled:true,response:await promise}:{handled:false};}
  return {handlers,maps,deleted,requests,batches,lifecycle,request,get skipped(){return skipped;},get claimed(){return claimed;}};
}
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
  await test('new draft cache version differs from deployed v14',async()=>{
    assert.ok(source.includes(`const CACHE = '${version}';`));assert.ok(!source.includes(`const CACHE = '${oldVersion}';`));
    const pwa=fs.readFileSync(path.join(root,'pwa.js'),'utf8');assert.ok(pwa.includes("new URL('sw.js', scriptURL)"));assert.ok(pwa.includes("scope: new URL('./', scriptURL).pathname"));
  });
  await test('install stages all current consent, policy, translation and chart assets coherently',async()=>{
    const w=worker();await w.lifecycle('install');assert.equal(w.batches.length,1);assert.equal(w.skipped,0);assert.deepEqual(w.deleted,[]);
    for(const file of ['analytics-consent.js','check-sync.js','i18n-pages.js','privacy/','privacy/index.html','en/privacy/','en/privacy/index.html','','cat/','en/dog/','en/cat/'])assert.ok(w.batches[0].includes(base+file),file);
    const cache=w.maps.get(version);assert.ok(cache.get(base+'analytics-consent.js').body.includes('pet-meal-analytics-consent-v2'));assert.ok(cache.get(base+'check-sync.js').body.includes('window.petMealUsage?.recordStored()'));
    assert.equal(w.requests.length,0);assert.ok(w.maps.has(oldVersion));
  });
  await test('failed install leaves old release available and never activates itself',async()=>{
    const w=worker({failInstall:true});await assert.rejects(w.lifecycle('install'),/mock precache failure/);
    assert.equal(w.maps.get(oldVersion).get(base).body,'OLD HTML');assert.equal(w.skipped,0);assert.equal(w.claimed,0);assert.deepEqual(w.deleted,[]);assert.equal(w.requests.length,0);
  });
  await test('only explicit existing update message requests activation',async()=>{
    const w=worker();w.handlers.message({data:{type:'UNRELATED'}});w.handlers.message({data:null});assert.equal(w.skipped,0);
    w.handlers.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.skipped,1);
    const app=fs.readFileSync(path.join(root,'check-sync.js'),'utf8');assert.ok(app.includes("registration.waiting.postMessage({type: 'ACTIVATE_UPDATE'})"));
  });
  await test('activate removes only earlier app caches and claims clients after cleanup',async()=>{
    const w=worker();await w.lifecycle('install');await w.lifecycle('activate');assert.deepEqual(w.deleted,[oldVersion]);assert.ok(w.maps.has(version));assert.ok(w.maps.has('unrelated-user-cache'));assert.equal(w.claimed,1);assert.equal(w.requests.length,0);
  });
  await test('current HTML and scripts come from the same new offline cache',async()=>{
    const w=worker();await w.lifecycle('install');await w.lifecycle('activate');
    for(const file of ['', 'cat/', 'en/dog/', 'en/cat/', 'analytics-consent.js', 'check-sync.js']) {
      const result=await w.request(base+file);assert.ok(result.handled);assert.notEqual(result.response.body,'OLD HTML');assert.notEqual(result.response.body,'OLD JS');assert.ok(result.response.body.length>100);
    }
    assert.equal(w.requests.length,0);
  });
  await test('worker does not intercept analytics, Firebase, affiliate, unknown or non-GET requests',async()=>{
    const w=worker();await w.lifecycle('install');
    for(const url of ['https://www.googletagmanager.com/gtag/js?id=fixture','https://www.google-analytics.com/g/collect','https://example.firebasedatabase.app/rooms/fixture.json','https://hb.afl.rakuten.co.jp/fixture',base+'unknown',base+'?wm_internal=1'])assert.equal((await w.request(url)).handled,false,url);
    assert.equal((await w.request(base,'POST')).handled,false);assert.equal(w.requests.length,0);
    assert.ok(!/localStorage|sessionStorage|indexedDB|fetch\s*\([^)]*(?:firebase|analytics)/.test(source));
  });
  console.log(`${passed} PWA release tests passed (mock lifecycle/caches and local asset bytes; no registration, browser, real PWA or network).`);
})().catch(error=>{console.error(error);process.exitCode=1;});
